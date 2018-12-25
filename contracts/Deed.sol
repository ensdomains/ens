pragma solidity >=0.4.24;

interface Deed {

    function setOwner(address newOwner) public;
    function setRegistrar(address newRegistrar) public;
    function setBalance(uint newValue, bool throwOnFailure) public;
    function closeDeed(uint refundRatio) public;
    function destroyDeed() public;

    function owner() public view returns (address);
    function previousOwner() public view returns (address);
    function value() public view returns (uint);
    function creationDate() public view returns (uint);

}
