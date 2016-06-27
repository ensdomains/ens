import "Resolver.sol";

/**
 * A registrar that allocates names to the first user to request them.
 */
contract OpenRegistrar is Resolver {
    uint32 constant DEFAULT_TTL = 3600;
    
    struct RegistrarEntry {
        address resolver;
        bytes12 nodeId;
        address owner;
    }

    mapping(bytes32=>RegistrarEntry) domains;
    
    function findResolver(bytes12 nodeId, bytes32 label) constant
        returns (uint16 rcode, uint32 ttl, bytes12 rnode, address raddress) {
        var ra = domains[label];
        if (nodeId != 0 || ra.owner == address(0)) {
            rcode = RCODE_NXDOMAIN;
            return;
        }
        ttl = DEFAULT_TTL;
        rnode = ra.nodeId;
        raddress = ra.resolver;
    }
        
    function resolve(bytes12 nodeId, bytes32 qtype, uint16 index) constant
        returns (uint16 rcode, bytes16 rtype, uint32 ttl, uint16 len,
                 bytes32 data) {
        if (nodeId != 0) {
            rcode = RCODE_NXDOMAIN;
            return;
        }
        // This resolver has no RRs, so return an empty record to indicate
        // there are none.
    }
    
    function getExtended(bytes32 id) constant returns (bytes data) {
        return "";
    }
    
    /**
     * @dev Registers a domain and points it at the provided resolver.
     * @param label The domain label hash.
     * @param resolver The resolver address to point the new domain at.
     * @param nodeId The node ID on the resolver.
     */
    function register(bytes32 label, address resolver, bytes12 nodeId) {
        if (resolver == 0)
            throw;
        var domain = domains[label];
        if (domain.owner != address(0))
            throw;
        domains[label] = RegistrarEntry(resolver, nodeId, msg.sender);
    }
    
    /**
     * @dev Transfers ownership of a domain to a new account.
     * @param label The domain label hash to update.
     * @param newOwner The new owner of the domain.
     */
    function setOwner(bytes32 label, address newOwner) {
        if (newOwner == 0)
            throw;
        var domain = domains[label];
        if (domain.owner != msg.sender)
            throw;
        domain.owner = newOwner;
    }
    
    /**
     * @dev Updates the resolver for a domain.
     * @param label The domain label hash to update.
     * @param resolver The new resolver to point to.
     * @param nodeId The node ID on the new resolver.
     */
    function setResolver(bytes32 label, address resolver, bytes12 nodeId) {
        if (resolver == 0)
            throw;
        var domain = domains[label];
        if (domain.owner != msg.sender)
            throw;
        domain.resolver = resolver;
        domain.nodeId = nodeId;
    }

    /**
     * @dev Gets the owner of a domain.
     * @param label The domain label hash to look up.
     * @return The owner of the provided domain, or 0 if it's not registered.
     */
    function getOwner(bytes32 label) constant returns (address) {
        return domains[label].owner;
    }
}
