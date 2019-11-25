pragma solidity ^0.5.0;

import "./ENS.sol";
import "./ENSRegistry.sol";

/**
 * The ENS registry contract.
 */
contract ENSRegistryWithFallback is ENSRegistry {

    ENS public old;

    // Permits modifications only by the owner of the specified node.
    modifier only_owner(bytes32 node) {
        require(records[node].owner == msg.sender);
        _;
    }

    /**
     * @dev Constructs a new ENS registrar.
     */
    constructor(ENS _old) public ENSRegistry() {
        old = _old;
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
}
