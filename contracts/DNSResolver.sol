pragma solidity ^0.4.0;

contract DNSResolver {
    address public owner;
    mapping(bytes32=>bytes) zones;
    
    function DNSResolver() {
        owner = msg.sender;
    }
    
    modifier owner_only {
        if (msg.sender != owner) throw;
        _;
    }
    
    function supportsInterface(bytes4 interfaceID) constant returns (bool) {
        return interfaceID == 0x126a710e;
    }
    
    function dnsrr(bytes32 node) constant returns (bytes data) {
        return zones[node];
    }
    
    function setDnsrr(bytes32 node, bytes data) owner_only {
        zones[node] = data;
    }
}
