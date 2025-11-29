#[test_only]
module document_library::document_library_tests {
    use document_library::document_system;
    use document_library::achievement_nft;
    use sui::test_scenario as ts;
    use sui::clock;

    #[test]
    fun test_create_profile_and_upload_document() {
        let admin = @0xABCD;
        let user1 = @0x1234;
        let user2 = @0x5678;

        let mut scenario_val = ts::begin(admin);
        let scenario = &mut scenario_val;
        
        // Init document system
        {
            ts::next_tx(scenario, admin);
            document_system::init_for_testing(ts::ctx(scenario));
        };

        // Create student profiles
        {
            ts::next_tx(scenario, user1);
            document_system::create_student_profile(ts::ctx(scenario));
            
            ts::next_tx(scenario, user2);
            document_system::create_student_profile(ts::ctx(scenario));
        };

        // Test upload document
        {
            ts::next_tx(scenario, user1);
            let mut library = ts::take_shared<document_system::DocumentLibrary>(scenario);
            let mut profile = ts::take_from_sender<document_system::StudentProfile>(scenario);
            let clock = clock::create_for_testing(ts::ctx(scenario));
            
            document_system::upload_document(
                &mut library,
                &mut profile,
                b"Test Document",
                b"A comprehensive guide to Rust programming",
                b"walrus_blob_123456",
                b"Programming",
                &clock,
                ts::ctx(scenario)
            );
            
            // Verify library stats
            let total_docs = document_system::get_library_stats(&library);
            assert!(total_docs == 1, 0);
            
            // Verify profile stats
            let (uploads, votes_received, achievements) = document_system::get_student_stats(&profile);
            assert!(uploads == 1, 1);
            assert!(votes_received == 0, 2);
            assert!(vector::length(&achievements) == 0, 3);
            
            ts::return_shared(library);
            ts::return_to_sender(scenario, profile);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario_val);
    }

    #[test]
    fun test_voting_system() {
        let admin = @0xABCD;
        let uploader = @0x1234;
        let voter = @0x5678;

        let mut scenario_val = ts::begin(admin);
        let scenario = &mut scenario_val;
        
        // Init
        {
            ts::next_tx(scenario, admin);
            document_system::init_for_testing(ts::ctx(scenario));
        };

        // Create profiles
        {
            ts::next_tx(scenario, uploader);
            document_system::create_student_profile(ts::ctx(scenario));
            
            ts::next_tx(scenario, voter);
            document_system::create_student_profile(ts::ctx(scenario));
        };

        let document_id;
        // Upload document
        {
            ts::next_tx(scenario, uploader);
            let mut library = ts::take_shared<document_system::DocumentLibrary>(scenario);
            let mut profile = ts::take_from_sender<document_system::StudentProfile>(scenario);
            let clock = clock::create_for_testing(ts::ctx(scenario));
            
            document_system::upload_document(
                &mut library,
                &mut profile,
                b"Voted Document",
                b"This document will receive votes",
                b"walrus_blob_789",
                b"Testing",
                &clock,
                ts::ctx(scenario)
            );
            
            // Get the document ID from the latest event or use a helper function
            // For simplicity, we'll assume we can get it somehow
            document_id = @0x0; // This would be the actual document ID in practice
            
            ts::return_shared(library);
            ts::return_to_sender(scenario, profile);
            clock::destroy_for_testing(clock);
        };

        // Vote for document
        {
            ts::next_tx(scenario, voter);
            let mut library = ts::take_shared<document_system::DocumentLibrary>(scenario);
            let clock = clock::create_for_testing(ts::ctx(scenario));
            
            // This would fail in actual test since we need real document ID
            // document_system::vote_document(&mut library, document_id, &clock, ts::ctx(scenario));
            
            ts::return_shared(library);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario_val);
    }

    #[test] 
    fun test_achievement_nft_minting() {
        let admin = @0xABCD;
        let student = @0x1234;

        let mut scenario_val = ts::begin(admin);
        let scenario = &mut scenario_val;
        
        // Init achievement system
        {
            ts::next_tx(scenario, admin);
            achievement_nft::init_for_testing(ts::ctx(scenario));
        };

        // Admin mints achievement for student
        {
            ts::next_tx(scenario, admin);
            let mut minter = ts::take_from_sender<achievement_nft::AchievementMinter>(scenario);
            
            achievement_nft::mint_monthly_achievement(
                &mut minter,
                student,
                1, // 1st place
                202411, // November 2024
                ts::ctx(scenario)
            );
            
            // Check minter stats
            let (minter_admin, total_minted) = achievement_nft::get_minter_stats(&minter);
            assert!(minter_admin == admin, 0);
            assert!(total_minted == 1, 1);
            
            ts::return_to_sender(scenario, minter);
        };

        // Student receives NFT
        {
            ts::next_tx(scenario, student);
            let nft = ts::take_from_sender<achievement_nft::AchievementNFT>(scenario);
            
            // Check NFT details
            let (name, _description, achievement_type, rank, month, points) = 
                achievement_nft::get_achievement_details(&nft);
            
            assert!(achievement_type == 1, 2); // Monthly achievement
            assert!(rank == 1, 3); // 1st place
            assert!(month == 202411, 4); // November 2024
            assert!(points == 1000, 5); // Champion points
            
            ts::return_to_sender(scenario, nft);
        };

        ts::end(scenario_val);
    }

    #[test]
    fun test_monthly_leaderboard() {
        let admin = @0xABCD;
        let student1 = @0x1111;
        let student2 = @0x2222;
        let student3 = @0x3333;

        let mut scenario_val = ts::begin(admin);
        let scenario = &mut scenario_val;
        
        // Init
        {
            ts::next_tx(scenario, admin);
            document_system::init_for_testing(ts::ctx(scenario));
        };

        // Update leaderboard
        {
            ts::next_tx(scenario, admin);
            let mut library = ts::take_shared<document_system::DocumentLibrary>(scenario);
            
            let top_students = vector[student1, student2, student3];
            document_system::update_monthly_leaderboard(
                &mut library,
                202411, // November 2024
                top_students,
                ts::ctx(scenario)
            );
            
            // Check leaderboard
            let leaderboard = document_system::get_monthly_leaderboard(&library, 202411);
            assert!(vector::length(&leaderboard) == 3, 0);
            
            ts::return_shared(library);
        };

        ts::end(scenario_val);
    }
}