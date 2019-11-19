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
     * @dev Returns the address that owns the specified node.
     * @param node The specified node.
     * @return address of the owner.
     */
    function owner(bytes32 node) external view returns (address) {
        if (!recordExists(node)) {
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
}
