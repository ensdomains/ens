pragma solidity ^0.5.0;

import "./ENS.sol";
import "./ENSRegistry.sol";

contract ENSRegistryWithFallback is ENSRegistry {

    ENS public old;

    // Permits modifications only by the owner of the specified node.
    modifier only_owner(bytes32 node) {
        require(records[node].owner == msg.sender);
        _;
    }

    constructor(ENS _old) public ENSRegistry() {
        old = _old;
    }
    /**
     * @dev Transfers ownership of a node to a new address. May only be called by the current owner of the node.
     * @param node The node to transfer ownership of.
     * @param owner The address of the new owner.
     */
    function setOwner(bytes32 node, address owner) external only_owner(node) {
        emit Transfer(node, owner);
        _setOwner(node, owner);
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
        _setOwner(subnode, owner);

    }

    /**
     * @dev Sets the record for a node.
     * @param node The node to update.
     * @param owner The address of the new owner.
     * @param resolver The address of the resolver.
     * @param ttl The TTL in seconds.
     */
    function setRecord(bytes32 node, address owner, address resolver, uint64 ttl) external only_owner(node) {
        if (records[node].ttl != ttl) {
            emit NewTTL(node, ttl);
            records[node].ttl = ttl;
        }

        if (records[node].resolver != resolver) {
            emit NewResolver(node, resolver);
            records[node].resolver = resolver;
        }

        if (records[node].owner != owner || (owner != address(0x0) && records[node].owner != address(this))) {
            emit Transfer(node, owner);
            _setOwner(node, owner);
        }
    }

    /**
     * @dev Returns the address that owns the specified node.
     * @param node The specified node.
     * @return address of the owner.
     */
    function owner(bytes32 node) external view returns (address) {
        if (!recordExists(node)) {
            return old.owner(node);
        }

        address addr = records[node].owner;
        if (addr == address(this)) {
            return address(0x0);
        }

        return addr;
    }

    /**
     * @dev Returns the address of the resolver for the specified node.
     * @param node The specified node.
     * @return address of the resolver.
     */
    function resolver(bytes32 node) external view returns (address) {
        if (!recordExists(node)) {
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
        if (!recordExists(node)) {
            return old.ttl(node);
        }

        return records[node].ttl;
    }

    /**
     * @dev Returns whether a record has been imported to the registry.
     * @param node The specified node.
     * @return Bool if record exists
     */
    function recordExists(bytes32 node) public view returns (bool) {
        return records[node].owner != address(0x0);
    }

    function _setOwner(bytes32 node, address owner) internal {
        address addr = owner;
        if (addr == address(0x0)) {
            addr = address(this);
        }

        records[node].owner = addr;
    }
}
