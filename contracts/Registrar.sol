pragma solidity >=0.4.24;

import "./Deed.sol";

interface Registrar {

    event AuctionStarted(bytes32 indexed hash, uint registrationDate);
    event NewBid(bytes32 indexed hash, address indexed bidder, uint deposit);
    event BidRevealed(bytes32 indexed hash, address indexed owner, uint value, uint8 status);
    event HashRegistered(bytes32 indexed hash, address indexed owner, uint value, uint registrationDate);
    event HashReleased(bytes32 indexed hash, uint value);
    event HashInvalidated(bytes32 indexed hash, string indexed name, uint value, uint registrationDate);


    function startAuction(bytes32 _hash) public;
    function startAuctions(bytes32[] memory _hashes) public;
    function newBid(bytes32 sealedBid) public payable;
    function startAuctionsAndBid(bytes32[] memory hashes, bytes32 sealedBid) public payable;
    function unsealBid(bytes32 _hash, uint _value, bytes32 _salt) public;
    function cancelBid(address bidder, bytes32 seal) public;
    function finalizeAuction(bytes32 _hash) public;
    function transfer(bytes32 _hash, address newOwner) public;
    function releaseDeed(bytes32 _hash) public;
    function invalidateName(string memory unhashedName) public;
    function eraseNode(bytes32[] memory labels) public;
    function transferRegistrars(bytes32 _hash) public;
    function acceptRegistrarTransfer(bytes32 hash, Deed deed, uint registrationDate) public;
}
