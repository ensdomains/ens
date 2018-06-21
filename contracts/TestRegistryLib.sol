pragma solidity ^0.4.22;

import './libs/ENSLib.sol';


/**
 * A registrar that allocates subdomains to the first person to claim them, but
 * expires registrations a fixed period after they're initially claimed.
 */
contract TestRegistryLib {
    using ENSLib for *;

    address public ensAddr;


    /**
     * Constructor.
     * @param _ensAddr The address of the ENS registry.
     */
    function TestRegistryLib(address _ensAddr) {
        ensAddr = _ensAddr;
    }

    /**
     * @dev Returns the address that owns the specified node.
     * @param node The specified node.
     * @return address of the owner.
     */
    function owner(bytes32 node) public view returns (address) {
      return node.owner(ensAddr);
    }

    /**
     * @dev Returns the address of the resolver for the specified node.
     * @param node The specified node.
     * @return address of the resolver.
     */
    function resolver(bytes32 node) public view returns (address) {
      return node.resolver(ensAddr);
    }

    /**
     * @dev Returns the TTL of a node, and any records associated with it.
     * @param node The specified node.
     * @return ttl of the node.
     */
    function ttl(bytes32 node) public view returns (uint64) {
      return node.ttl(ensAddr);
    }

    /**
     * @dev Returns the address that owns the specified ens.
     * @param ensName The specified ens.
     * @return address of the owner.
     */
    function ownerByENSName(string ensName) public view returns (address) {
      return ensName.owner(ensAddr);
    }

    /**
     * Get the hash of an ens by his name
     * @param ensName The name of the ens to hash
     */
    function hashname(string ensName) public view returns (bytes32){
      return ensName.hashname();
    }
}
