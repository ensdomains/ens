/**
 * ENS resolver interface.
 */
contract Resolver {
    bytes32 constant TYPE_STAR = "*";
    
    // Response codes.
    uint16 constant RCODE_OK = 0;
    uint16 constant RCODE_NXDOMAIN = 3;

    function findResolver(bytes12 nodeId, bytes32 label) constant
        returns (uint16 rcode, uint32 ttl, bytes12 rnode, address raddress);
    function resolve(bytes12 nodeId, bytes32 qtype, uint16 index) constant
        returns (uint16 rcode, bytes16 rtype, uint32 ttl, uint16 len,
                 bytes32 data);
    function getExtended(bytes32 id) constant returns (bytes data);
}
