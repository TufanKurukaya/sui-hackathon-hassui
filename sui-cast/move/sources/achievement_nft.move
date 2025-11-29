module document_library::achievement_nft {
    use sui::object::{UID, ID};
    use sui::tx_context::TxContext;
    use sui::url::{Self, Url};
    use sui::event;
    use sui::display;
    use sui::package;
    use std::string::{Self, String};

    // === Structs ===

    public struct AchievementNFT has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: Url,
        achievement_type: u8, // 1: Monthly Winner, 2: Top Uploader, 3: Popular Document
        month: u64,
        rank: u8, // 1st, 2nd, 3rd
        recipient: address,
        points_earned: u64,
    }

    public struct AchievementMinter has key {
        id: UID,
        admin: address,
        total_minted: u64,
    }

    public struct ACHIEVEMENT_NFT has drop {}

    // === Events ===

    public struct AchievementMinted has copy, drop {
        nft_id: ID,
        recipient: address,
        achievement_type: u8,
        rank: u8,
        month: u64,
    }

    public struct AchievementTransferred has copy, drop {
        nft_id: ID,
        from: address,
        to: address,
    }

    // === Error Codes ===
    
    const E_NOT_ADMIN: u64 = 0;
    const E_INVALID_RANK: u64 = 1;

    // === Init Function ===

    fun init(otw: ACHIEVEMENT_NFT, ctx: &mut TxContext) {
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"achievement_type"),
            string::utf8(b"rank"),
            string::utf8(b"month"),
            string::utf8(b"points_earned"),
        ];

        let values = vector[
            string::utf8(b"{name}"),
            string::utf8(b"{description}"),
            string::utf8(b"{image_url}"),
            string::utf8(b"Type: {achievement_type}"),
            string::utf8(b"Rank: {rank}"),
            string::utf8(b"Month: {month}"),
            string::utf8(b"Points: {points_earned}"),
        ];

        let publisher = package::claim(otw, ctx);
        let mut display = display::new_with_fields<AchievementNFT>(&publisher, keys, values, ctx);
        display::update_version(&mut display);

        let minter = AchievementMinter {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            total_minted: 0,
        };

        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
        transfer::transfer(minter, tx_context::sender(ctx));
    }

    // === Public Functions ===

    /// Mint monthly achievement NFT for top performers
    public fun mint_monthly_achievement(
        minter: &mut AchievementMinter,
        recipient: address,
        rank: u8,
        month: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == minter.admin, E_NOT_ADMIN);
        assert!(rank >= 1 && rank <= 3, E_INVALID_RANK);
        
        let (name, description, image_url, points) = get_monthly_achievement_metadata(rank);
        
        let nft = AchievementNFT {
            id: object::new(ctx),
            name,
            description,
            image_url,
            achievement_type: 1, // Monthly achievement
            month,
            rank,
            recipient,
            points_earned: points,
        };

        let nft_id = object::id(&nft);
        minter.total_minted = minter.total_minted + 1;
        
        event::emit(AchievementMinted {
            nft_id,
            recipient,
            achievement_type: 1,
            rank,
            month,
        });

        transfer::transfer(nft, recipient);
    }

    /// Mint special achievement for top uploaders
    public fun mint_uploader_achievement(
        minter: &mut AchievementMinter,
        recipient: address,
        uploads_count: u64,
        month: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == minter.admin, E_NOT_ADMIN);
        
        let (name, description, image_url) = get_uploader_achievement_metadata(uploads_count);
        
        let nft = AchievementNFT {
            id: object::new(ctx),
            name,
            description,
            image_url,
            achievement_type: 2, // Uploader achievement
            month,
            rank: 0, // N/A for this type
            recipient,
            points_earned: uploads_count * 10,
        };

        let nft_id = object::id(&nft);
        minter.total_minted = minter.total_minted + 1;
        
        event::emit(AchievementMinted {
            nft_id,
            recipient,
            achievement_type: 2,
            rank: 0,
            month,
        });

        transfer::transfer(nft, recipient);
    }

    /// Mint popular document achievement
    public fun mint_popular_document_achievement(
        minter: &mut AchievementMinter,
        recipient: address,
        votes_received: u64,
        month: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == minter.admin, E_NOT_ADMIN);
        
        let (name, description, image_url) = get_popular_document_achievement_metadata(votes_received);
        
        let nft = AchievementNFT {
            id: object::new(ctx),
            name,
            description,
            image_url,
            achievement_type: 3, // Popular document achievement
            month,
            rank: 0, // N/A for this type
            recipient,
            points_earned: votes_received * 5,
        };

        let nft_id = object::id(&nft);
        minter.total_minted = minter.total_minted + 1;
        
        event::emit(AchievementMinted {
            nft_id,
            recipient,
            achievement_type: 3,
            rank: 0,
            month,
        });

        transfer::transfer(nft, recipient);
    }

    // === Helper Functions ===

    fun get_monthly_achievement_metadata(rank: u8): (String, String, Url, u64) {
        if (rank == 1) {
            (
                string::utf8(b"🏆 Monthly Champion"),
                string::utf8(b"Awarded to the #1 contributor of the month in 42 Document Library"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/gold-trophy.png"),
                1000
            )
        } else if (rank == 2) {
            (
                string::utf8(b"🥈 Monthly Runner-up"),
                string::utf8(b"Awarded to the #2 contributor of the month in 42 Document Library"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/silver-trophy.png"),
                500
            )
        } else {
            (
                string::utf8(b"🥉 Monthly Top 3"),
                string::utf8(b"Awarded to the #3 contributor of the month in 42 Document Library"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/bronze-trophy.png"),
                250
            )
        }
    }

    fun get_uploader_achievement_metadata(uploads_count: u64): (String, String, Url) {
        if (uploads_count >= 50) {
            (
                string::utf8(b"📚 Master Contributor"),
                string::utf8(b"Shared 50+ valuable documents with the 42 community"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/master-contributor.png")
            )
        } else if (uploads_count >= 20) {
            (
                string::utf8(b"📖 Knowledge Sharer"),
                string::utf8(b"Shared 20+ documents with the 42 community"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/knowledge-sharer.png")
            )
        } else {
            (
                string::utf8(b"📝 Active Contributor"),
                string::utf8(b"Actively contributing to the 42 Document Library"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/active-contributor.png")
            )
        }
    }

    fun get_popular_document_achievement_metadata(votes_received: u64): (String, String, Url) {
        if (votes_received >= 100) {
            (
                string::utf8(b"⭐ Viral Content Creator"),
                string::utf8(b"Created content that received 100+ votes"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/viral-creator.png")
            )
        } else if (votes_received >= 50) {
            (
                string::utf8(b"💎 Popular Creator"),
                string::utf8(b"Created content that received 50+ votes"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/popular-creator.png")
            )
        } else {
            (
                string::utf8(b"👍 Appreciated Creator"),
                string::utf8(b"Created appreciated content in the 42 community"),
                url::new_unsafe_from_bytes(b"https://your-cdn.com/appreciated-creator.png")
            )
        }
    }

    // === View Functions ===

    /// Get achievement NFT details
    public fun get_achievement_details(nft: &AchievementNFT): (String, String, u8, u8, u64, u64) {
        (
            nft.name,
            nft.description,
            nft.achievement_type,
            nft.rank,
            nft.month,
            nft.points_earned
        )
    }

    /// Get minter statistics
    public fun get_minter_stats(minter: &AchievementMinter): (address, u64) {
        (minter.admin, minter.total_minted)
    }

    /// Check if address is admin
    public fun is_admin(minter: &AchievementMinter, addr: address): bool {
        minter.admin == addr
    }
}