// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EvidenceRegistry
/// @notice Stores ONLY tamper-proof hashes for PurposeBound Treasury. The
/// private documents (agreements, invoices, receipts, photos) never touch the
/// chain — they stay in Google Drive. Anchoring a hash here proves the content
/// existed at a point in time and was not silently modified afterwards.
///
/// One tiny contract, by design: the app computes SHA-256 off-chain and anchors
/// the digest. To wire it live, deploy this, set EVIDENCE_REGISTRY_ADDRESS and
/// CHAIN_RPC_URL, and have lib/hash.ts send `anchor(kind, refId, digest)`.
contract EvidenceRegistry {
    struct Anchor {
        bytes32 digest;     // sha256 of the off-chain content
        string kind;        // "rules" | "expense" | "evidence" | "transfer" | "report"
        string refId;       // app-side id of the anchored object
        uint256 timestamp;  // block time
        address anchoredBy;
    }

    Anchor[] public anchors;
    // digest => index+1 (0 means "not anchored"), so re-anchoring is detectable.
    mapping(bytes32 => uint256) public indexOfDigest;

    event Anchored(bytes32 indexed digest, string kind, string refId, uint256 timestamp, address indexed by);

    function anchor(bytes32 digest, string calldata kind, string calldata refId) external returns (uint256 id) {
        id = anchors.length;
        anchors.push(Anchor(digest, kind, refId, block.timestamp, msg.sender));
        indexOfDigest[digest] = id + 1;
        emit Anchored(digest, kind, refId, block.timestamp, msg.sender);
    }

    /// @notice True if this exact content hash was anchored before.
    function isAnchored(bytes32 digest) external view returns (bool) {
        return indexOfDigest[digest] != 0;
    }

    function count() external view returns (uint256) {
        return anchors.length;
    }
}
