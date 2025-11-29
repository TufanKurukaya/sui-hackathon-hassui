module document_library::document_system {
    use sui::object::{UID, ID};
    use sui::tx_context::TxContext;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};

    // === Struct Definitions ===
    
    public struct DocumentLibrary has key {
        id: UID,
        documents: Table<ID, Document>,
        monthly_leaderboard: Table<u64, vector<LeaderboardEntry>>, // month -> entries
        total_documents: u64,
    }

    public struct Document has key, store {
        id: UID,
        title: String,
        description: String,
        walrus_blob_id: String, // Walrus'ta saklanan döküman ID'si
        uploader: address,
        upload_timestamp: u64,
        votes: u64,
        voters: vector<address>, // Double voting önleme
        category: String,
    }

    public struct StudentProfile has key {
        id: UID,
        student_address: address,
        total_uploads: u64,
        total_votes_received: u64,
        monthly_points: Table<u64, u64>, // month -> points
        achievements: vector<ID>, // NFT achievement IDs
    }

    public struct LeaderboardEntry has store, copy, drop {
        student: address,
        points: u64,
    }

    // === Events ===

    public struct DocumentUploaded has copy, drop {
        document_id: ID,
        uploader: address,
        title: String,
        timestamp: u64,
    }

    public struct DocumentVoted has copy, drop {
        document_id: ID,
        voter: address,
        new_vote_count: u64,
    }

    public struct MonthlyLeaderboardUpdated has copy, drop {
        month: u64,
        top_students: vector<address>,
    }

    // === Error Codes ===
    
    const E_ALREADY_VOTED: u64 = 0;
    const E_CANNOT_VOTE_OWN_DOCUMENT: u64 = 1;
    const E_DOCUMENT_NOT_FOUND: u64 = 2;
    const E_PROFILE_NOT_FOUND: u64 = 3;

    // === Init Function ===

    fun init(ctx: &mut TxContext) {
        let library = DocumentLibrary {
            id: object::new(ctx),
            documents: table::new(ctx),
            monthly_leaderboard: table::new(ctx),
            total_documents: 0,
        };
        transfer::share_object(library);
    }

    // === Public Functions ===

    /// Create a new student profile
    entry fun create_student_profile(ctx: &mut TxContext) {
        let profile = StudentProfile {
            id: object::new(ctx),
            student_address: tx_context::sender(ctx),
            total_uploads: 0,
            total_votes_received: 0,
            monthly_points: table::new(ctx),
            achievements: vector::empty(),
        };
        transfer::transfer(profile, tx_context::sender(ctx));
    }

    /// Upload a new document to the library
    entry fun upload_document(
        library: &mut DocumentLibrary,
        profile: &mut StudentProfile,
        title: vector<u8>,
        description: vector<u8>,
        walrus_blob_id: vector<u8>,
        category: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let document = Document {
            id: object::new(ctx),
            title: string::utf8(title),
            description: string::utf8(description),
            walrus_blob_id: string::utf8(walrus_blob_id),
            uploader: tx_context::sender(ctx),
            upload_timestamp: clock::timestamp_ms(clock),
            votes: 0,
            voters: vector::empty(),
            category: string::utf8(category),
        };

        let document_id = object::id(&document);
        
        // Library'e ekle
        table::add(&mut library.documents, document_id, document);
        library.total_documents = library.total_documents + 1;

        // Profile güncelle
        profile.total_uploads = profile.total_uploads + 1;
        
        // Aylık puan ekle (upload = 10 puan)
        let current_month = get_current_month(clock);
        add_monthly_points(profile, current_month, 10);

        event::emit(DocumentUploaded {
            document_id,
            uploader: tx_context::sender(ctx),
            title: string::utf8(title),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Vote for a document
    entry fun vote_document(
        library: &mut DocumentLibrary,
        document_id: ID,
        _clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(table::contains(&library.documents, document_id), E_DOCUMENT_NOT_FOUND);
        
        let document = table::borrow_mut(&mut library.documents, document_id);
        let voter = tx_context::sender(ctx);
        
        // Kendi dökümanına oy veremez
        assert!(document.uploader != voter, E_CANNOT_VOTE_OWN_DOCUMENT);
        
        // Daha önce oy vermiş mi kontrol et
        assert!(!vector::contains(&document.voters, &voter), E_ALREADY_VOTED);
        
        // Oy ekle
        document.votes = document.votes + 1;
        vector::push_back(&mut document.voters, voter);
        
        event::emit(DocumentVoted {
            document_id,
            voter,
            new_vote_count: document.votes,
        });
    }

    /// Add achievement NFT to student profile
    entry fun add_achievement_to_profile(
        profile: &mut StudentProfile,
        achievement_id: ID,
        _ctx: &TxContext
    ) {
        assert!(profile.student_address == tx_context::sender(_ctx), E_PROFILE_NOT_FOUND);
        vector::push_back(&mut profile.achievements, achievement_id);
    }

    /// Update monthly leaderboard
    entry fun update_monthly_leaderboard(
        library: &mut DocumentLibrary,
        month: u64,
        top_students: vector<address>,
        _ctx: &TxContext
    ) {
        let mut leaderboard_entries = vector::empty<LeaderboardEntry>();
        let mut i = 0;
        
        while (i < vector::length(&top_students)) {
            let student = *vector::borrow(&top_students, i);
            let entry = LeaderboardEntry {
                student,
                points: (vector::length(&top_students) - i) * 100, // Sıralama puanı
            };
            vector::push_back(&mut leaderboard_entries, entry);
            i = i + 1;
        };

        if (table::contains(&library.monthly_leaderboard, month)) {
            table::remove(&mut library.monthly_leaderboard, month);
        };
        table::add(&mut library.monthly_leaderboard, month, leaderboard_entries);

        event::emit(MonthlyLeaderboardUpdated {
            month,
            top_students,
        });
    }

    // === Helper Functions ===

    fun get_current_month(clock: &Clock): u64 {
        // Basit month hesabı (gerçekte daha detaylı olmalı)
        clock::timestamp_ms(clock) / (30 * 24 * 60 * 60 * 1000) // 30 günlük periyot
    }

    fun add_monthly_points(profile: &mut StudentProfile, month: u64, points: u64) {
        let current_points = if (table::contains(&profile.monthly_points, month)) {
            *table::borrow(&profile.monthly_points, month)
        } else { 0 };
        
        if (table::contains(&profile.monthly_points, month)) {
            *table::borrow_mut(&mut profile.monthly_points, month) = current_points + points;
        } else {
            table::add(&mut profile.monthly_points, month, points);
        };
    }

    // === View Functions ===

    /// Get document information
    public fun get_document_info(library: &DocumentLibrary, document_id: ID): (String, String, String, u64, address, u64) {
        assert!(table::contains(&library.documents, document_id), E_DOCUMENT_NOT_FOUND);
        let document = table::borrow(&library.documents, document_id);
        (
            document.title, 
            document.description, 
            document.walrus_blob_id,
            document.votes, 
            document.uploader, 
            document.upload_timestamp
        )
    }

    /// Get library statistics
    public fun get_library_stats(library: &DocumentLibrary): u64 {
        library.total_documents
    }

    /// Get student profile info
    public fun get_student_stats(profile: &StudentProfile): (u64, u64, vector<ID>) {
        (profile.total_uploads, profile.total_votes_received, profile.achievements)
    }

    /// Get monthly points for a student
    public fun get_monthly_points(profile: &StudentProfile, month: u64): u64 {
        if (table::contains(&profile.monthly_points, month)) {
            *table::borrow(&profile.monthly_points, month)
        } else {
            0
        }
    }

    /// Get monthly leaderboard
    public fun get_monthly_leaderboard(library: &DocumentLibrary, month: u64): vector<LeaderboardEntry> {
        if (table::contains(&library.monthly_leaderboard, month)) {
            *table::borrow(&library.monthly_leaderboard, month)
        } else {
            vector::empty<LeaderboardEntry>()
        }
    }
}