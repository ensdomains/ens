import 'Resolver.sol';
import 'solidity-stringutils/strings.sol';

/**
 * @dev Provides a convenient interface for doing ENS name resolution.
 *      Does not support extended records.
 */
library LocalResolver {
    using strings for *;

    // Response codes.
    uint8 constant RCODE_OK = 0;
    uint8 constant RCODE_NXDOMAIN = 3;

    /**
     * @dev Finds the authoritative resolver for a name.
     * @param root The address of the root ENS server to query.
     * @param name The name to look up.
     * @return rcode The response code.
     * @return resolver The resolver that's authoritative for this name.
     * @return nodeId The node ID on the resolver for this name.
     */
    function findResolver(address root, string name) internal
        returns (uint16 rcode, Resolver resolver, bytes12 nodeId)
    {
        resolver = Resolver(root);
        var n = name.toSlice();
        while (!n.empty()) {
            var label = n.rsplit(".".toSlice());
            uint32 ttl;
            address addr;
            (rcode, ttl, nodeId, addr) = resolver.findResolver(nodeId, label.keccak());
            if (rcode != RCODE_OK)
                return;
            resolver = Resolver(addr);
        }
    }

    /**
     * @dev Resolves a name and query type, returning the first record.
     * @param root The address of the root ENS server to query.
     * @param name The name to look up.
     * @param qtype The record type to query (eg, "*", "HA", "CHASH")
     * @return rcode The response code.
     * @return rtype The record type returned (eg, "HA", "CHASH")
     * @return len The length of the returned record.
     * @return data The returned record if len <= 32, or the pointer to the
     *         extended record if len >32.
     */
    function resolveOne(address root, string name, bytes16 qtype) internal
        returns (uint16 rcode, bytes16 rtype, uint16 len, bytes32 data)
    {
        Resolver resolver;
        bytes12 nodeId;
        (rcode, resolver, nodeId) = findResolver(root, name);
        if (rcode != RCODE_OK)
            return;

        uint32 ttl;
        (rcode, rtype, ttl, len, data) = resolver.resolve(nodeId, qtype, 0);
    }

    /**
     * @dev Gets the first "HA" record for a name. Returns address(0) on failure.
     * @param root The address of the root ENS server to query.
     * @param name The name to look up.
     * @return The address of the first HA record of the provided name, or
     *         address(0) if the name or the record don't exist.
     */
    function addr(address root, string name) internal returns (address) {
        var (rcode, rtype, len, data) = resolveOne(root, name, "HA");
        return address(data);
    }
}