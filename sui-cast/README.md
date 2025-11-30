# 🎓 Sui-Cast: Decentralized Student Document Library

Sui-Cast is a Web3 platform that allows students to share lecture notes, projects, and academic resources in a decentralized manner, vote on them, and earn NFT achievements in return for their contributions.

This project is powered by the high performance of **Sui Blockchain**, the decentralized storage solution of **Walrus**, and the user-friendly login experience of **zkLogin**.

---

## 🚀 Technologies and Integrations Used

Our project brings together the most up-to-date and powerful tools of the Sui ecosystem. Below are details and examples of how these technologies are used in our project.

| Technology / Tool | Purpose in Project | Related Files |
|-------------------|--------------------|---------------|
| **Sui Move** | Smart contract logic, `DocumentLibrary` and `StudentProfile` structures. | `move/sources/document_system.move` |
| **Sui dApp Kit** | Wallet connection and hooks in React interface. | `src/main.tsx`, `src/pages/LoginPage.tsx` |
| **Walrus** | Decentralized storage of large files (PDF, Images). | `src/pages/DocumentsPage.tsx` |
| **Sui TypeScript SDK** | Interaction with blockchain from frontend (PTB creation). | `src/lib/contracts.ts` |
| **Sui zkLogin** | Allowing Web2 users to log in without a wallet using Google. | `src/components/ZkLoginCard.tsx` |
| **Surflux** | Real-time notifications when a document is uploaded or voted on. | `src/lib/surflux.ts` |

---

## 💻 Usage with Code Examples

### 1. Sui Move & Object Model (Sui Official Docs & The Move Book)
We use Move language's `struct` and `object` capabilities for on-chain representation of documents and student profiles.

```move
// move/sources/document_system.move

public struct Document has key, store {
    id: UID,
    title: String,
    description: String,
    walrus_blob_id: String, // File reference on Walrus
    uploader: address,
    votes: u64,
    category: String,
}
```

### 2. Walrus Integration (Walrus Docs)
Users upload files directly to Walrus and save the returned `blobId` to the Sui blockchain. This keeps file content decentralized while ownership and metadata are kept on Sui.

```typescript
// src/pages/DocumentsPage.tsx (Example Flow)

// 1. Upload file to Walrus Publisher
const response = await fetch(`${WALRUS_PUBLISHER}/v1/store`, {
    method: "PUT",
    body: file
});
const data = await response.json();
const blobId = data.newlyCreated.blobObject.blobId;

// 2. Save Blob ID to Sui smart contract
uploadDocument(profileId, title, description, blobId, category);
```

### 3. Sui TypeScript SDK & PTB
We use the SDK's Programmable Transaction Block (PTB) structure to create and manage transactions.

```typescript
// src/lib/contracts.ts

export function uploadDocument(
  profileId: string,
  title: string,
  walrusBlobId: string,
  // ...
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::upload_document`,
    arguments: [
      tx.object(DOCUMENT_LIBRARY_ID),
      tx.object(profileId),
      tx.pure.string(title),
      tx.pure.string(walrusBlobId), // Walrus ID is linked here
      // ...
    ],
  });
  
  return tx;
}
```

### 4. Real-Time Updates (Surflux)
To enhance user experience, we listen to blockchain events with Surflux and show instant notifications.

```typescript
// src/lib/surflux.ts

export function useDocumentEventStream() {
  // Listen for 'DocumentUploaded' events via Surflux
  const query = `
    SELECT * FROM ${PACKAGE_ID}::document_system::DocumentUploaded
    ORDER BY timestamp DESC
  `;
  // ...
}
```

### 5. zkLogin (Sui zkLogin)
We enable students without crypto wallets to log in to the system using their Google accounts.

```typescript
// src/components/ZkLoginCard.tsx

// Generating salt and proof after Google OAuth flow
const zkLoginSignature = getZkLoginSignature({
    inputs: zkProof,
    maxEpoch,
    userSignature,
});
```

---

## 🛠️ Installation and Running

To run the project in your local environment:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/username/sui-cast.git
   cd sui-cast
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Compile Move Contracts (Optional):**
   ```bash
   cd move
   sui move build
   ```

---

## 🎯 Our Goal

Sui-Cast aims to ensure the free circulation of academic knowledge while transparently rewarding contributing students. It offers an end-user familiar and fast Web2 experience by keeping the complexity of Web3 technologies (Sui, Walrus, zkLogin) in the background.
