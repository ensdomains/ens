pragma solidity ^0.5.0;

import "./ENS.sol";

contract MigrationENS is ENS {

    struct Record {
        address owner;
        address resolver;
        uint64 ttl;
    }

    mapping (bytes32 => Record) records;
    mapping (bytes32 => bool) migrated;

    ENS public old;

    // Permits modifications only by the owner of the specified node.
    modifier only_owner(bytes32 node) {
        require(records[node].owner == msg.sender);
        _;
    }

    // Logged when the node is migrated
    event Migrated(bytes32 indexed node);

    constructor(ENS _old) public {
        old = _old;
        records[0x0].owner = msg.sender;
    }

    // @todo this doesn't completely work as certain names could be registered on the new ENS
    function migrate(bytes32 node, bytes32 label) external {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        require(!migrated[subnode]);
        require(old.owner(node) == msg.sender);

        records[node] = Record(msg.sender, old.resolver(subnode), old.ttl(node));
        emit Migrated(subnode);
    }

    /**
     * @dev Transfers ownership of a node to a new address. May only be called by the current owner of the node.
     * @param node The node to transfer ownership of.
     * @param owner The address of the new owner.
     */
    function setOwner(bytes32 node, address owner) external only_owner(node) {
        emit Transfer(node, owner);
        records[node].owner = owner;
    }

    /**
     * @dev Transfers ownership of a subnode keccak256(node, label) to a new address. May only be called by the owner of the parent node.
     * @param node The parent node.
     * @param label The hash of the label specifying the subnode.
     * @param owner The address of the new owner.
     */
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external only_owner(node) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        emit NewOwner(node, label, owner);
        records[subnode].owner = owner;
    }

    /**
     * @dev Sets the resolver address for the specified node.
     * @param node The node to update.
     * @param resolver The address of the resolver.
     */
    function setResolver(bytes32 node, address resolver) external only_owner(node) {
        emit NewResolver(node, resolver);
        records[node].resolver = resolver;
    }

    /**
     * @dev Sets the TTL for the specified node.
     * @param node The node to update.
     * @param ttl The TTL in seconds.
     */
    function setTTL(bytes32 node, uint64 ttl) external only_owner(node) {
        emit NewTTL(node, ttl);
        records[node].ttl = ttl;
    }

    /**
     * @dev Returns the address that owns the specified node.
     * @param node The specified node.
     * @return address of the owner.
     */
    function owner(bytes32 node) external view returns (address) {
        if (!migrated[node]) {
            return old.owner(node);
        }

        return records[node].owner;
    }

    /**
     * @dev Returns the address of the resolver for the specified node.
     * @param node The specified node.
     * @return address of the resolver.
     */
    function resolver(bytes32 node) external view returns (address) {
        if (!migrated[node]) {
            return old.resolver(node);
        }

        return records[node].resolver;
    }

    /**
     * @dev Returns the TTL of a node, and any records associated with it.
     * @param node The specified node.
     * @return ttl of the node.
     */
    function ttl(bytes32 node) external view returns (uint64) {
        if (!migrated[node]) {
            return old.ttl(node);
        }

        return records[node].ttl;
    }
}
