pragma solidity ^0.4.0;


/*

Temporary Hash Registrar
========================

This is a simplified version of a hash registrar. It is purporsefully limited:
names cannot be six letters or shorter, new auctions will stop after 4 years.

The plan is to test the basic features and then move to a new contract in at most
2 years, when some sort of renewal mechanism will be enabled.
*/


import './AbstractENS.sol';


/**
 * @title Deed to hold ether in exchange for ownership of a node
 * @dev The deed can be controlled only by the registrar and can only send ether back to the owner.
 */
contract Deed {
    address public registrar;
    address constant burn = 0xdead;
    uint public creationDate;
    address public owner;
    address public previousOwner;
    uint public value;
    event OwnerChanged(address newOwner);
    event DeedClosed();
    bool active;

    modifier onlyRegistrar {
        if (msg.sender != registrar) throw;
        _;
    }

    modifier onlyActive {
        if (!active) throw;
        _;
    }

    function Deed(address _owner) payable {
        owner = _owner;
        registrar = msg.sender;
        creationDate = now;
        active = true;
        value = msg.value;
    }

    function setOwner(address newOwner) onlyRegistrar {
        if (newOwner == 0) throw;
        previousOwner = owner;  // This allows contracts to check who sent them the ownership
        owner = newOwner;
        OwnerChanged(newOwner);
    }

    function setRegistrar(address newRegistrar) onlyRegistrar {
        registrar = newRegistrar;
    }

    function setBalance(uint newValue, bool throwOnFailure) onlyRegistrar onlyActive {
        // Check if it has enough balance to set the value
        if (value < newValue) throw;
        value = newValue;
        // Send the difference to the owner
        if (!owner.send(this.balance - newValue) && throwOnFailure) throw;
    }

    /**
     * @dev Close a deed and refund a specified fraction of the bid value
     *
     * @param refundRatio The amount*1/1000 to refund
     */
    function closeDeed(uint refundRatio) onlyRegistrar onlyActive {
        active = false;
        if (! burn.send(((1000 - refundRatio) * this.balance)/1000)) throw;
        DeedClosed();
        destroyDeed();
    }

    /**
     * @dev Close a deed and refund a specified fraction of the bid value
     */
    function destroyDeed() {
        if (active) throw;
        
        // Instead of selfdestruct(owner), invoke owner fallback function to allow
        // owner to log an event if desired; but owner should also be aware that
        // its fallback function can also be invoked by setBalance
        if (owner.send(this.balance)) {
            selfdestruct(burn);
        }
    }
}

/**
 * @title Registrar
 * @dev The registrar handles the auction process for each subnode of the node it owns.
 */
contract Registrar {
    AbstractENS public ens;
    bytes32 public rootNode;

    mapping (bytes32 => entry) _entries;
    mapping (address => mapping(bytes32 => Deed)) public sealedBids;
    
    enum Mode { Open, Auction, Owned, Forbidden, Reveal, NotYetAvailable }

    uint32 constant totalAuctionLength = 5 days;
    uint32 constant revealPeriod = 48 hours;
    uint32 public constant launchLength = 8 weeks;

    uint constant minPrice = 0.01 ether;
    uint public registryStarted;

    event AuctionStarted(bytes32 indexed hash, uint registrationDate);
    event NewBid(bytes32 indexed hash, address indexed bidder, uint deposit);
    event BidRevealed(bytes32 indexed hash, address indexed owner, uint value, uint8 status);
    event HashRegistered(bytes32 indexed hash, address indexed owner, uint value, uint registrationDate);
    event HashReleased(bytes32 indexed hash, uint value);
    event HashInvalidated(bytes32 indexed hash, string indexed name, uint value, uint registrationDate);

    struct entry {
        Deed deed;
        uint registrationDate;
        uint value;
        uint highestBid;
    }

    // State transitions for names:
    //   Open -> Auction (startAuction)
    //   Auction -> Reveal
    //   Reveal -> Owned
    //   Reveal -> Open (if nobody bid)
    //   Owned -> Open (releaseDeed or invalidateName)
    function state(bytes32 _hash) constant returns (Mode) {
        var entry = _entries[_hash];
        
        if (!isAllowed(_hash, now)) {
            return Mode.NotYetAvailable;
        } else if (now < entry.registrationDate) {
            if (now < entry.registrationDate - revealPeriod) {
                return Mode.Auction;
            } else {
                return Mode.Reveal;
            }
        } else {
            if (entry.highestBid == 0) {
                return Mode.Open;
            } else {
                return Mode.Owned;
            }
        }
    }

    modifier inState(bytes32 _hash, Mode _state) {
        if (state(_hash) != _state) throw;
        _;
    }

    modifier onlyOwner(bytes32 _hash) {
        if (state(_hash) != Mode.Owned || msg.sender != _entries[_hash].deed.owner()) throw;
        _;
    }

    modifier registryOpen() {
        if (now < registryStarted  || now > registryStarted + 4 years || ens.owner(rootNode) != address(this)) throw;
        _;
    }

    function entries(bytes32 _hash) constant returns (Mode, address, uint, uint, uint) {
        entry h = _entries[_hash];
        return (state(_hash), h.deed, h.registrationDate, h.value, h.highestBid);
    }

    /**
     * @dev Constructs a new Registrar, with the provided address as the owner of the root node.
     *
     * @param _ens The address of the ENS
     * @param _rootNode The hash of the rootnode.
     */
    function Registrar(AbstractENS _ens, bytes32 _rootNode, uint _startDate) {
        ens = _ens;
        rootNode = _rootNode;
        registryStarted = _startDate > 0 ? _startDate : now;
    }

    /**
     * @dev Returns the maximum of two unsigned integers
     *
     * @param a A number to compare
     * @param b A number to compare
     * @return The maximum of two unsigned integers
     */
    function max(uint a, uint b) internal constant returns (uint max) {
        if (a > b)
            return a;
        else
            return b;
    }

    /**
     * @dev Returns the minimum of two unsigned integers
     *
     * @param a A number to compare
     * @param b A number to compare
     * @return The minimum of two unsigned integers
     */
    function min(uint a, uint b) internal constant returns (uint min) {
        if (a < b)
            return a;
        else
            return b;
    }

    /**
     * @dev Returns the length of a given string
     *
     * @param s The string to measure the length of
     * @return The length of the input string
     */
    function strlen(string s) internal constant returns (uint) {
        s; // Don't warn about unused variables
        // Starting here means the LSB will be the byte we care about
        uint ptr;
        uint end;
        assembly {
            ptr := add(s, 1)
            end := add(mload(s), ptr)
        }
        for (uint len = 0; ptr < end; len++) {
            uint8 b;
            assembly { b := and(mload(ptr), 0xFF) }
            if (b < 0x80) {
                ptr += 1;
            } else if (b < 0xE0) {
                ptr += 2;
            } else if (b < 0xF0) {
                ptr += 3;
            } else if (b < 0xF8) {
                ptr += 4;
            } else if (b < 0xFC) {
                ptr += 5;
            } else {
                ptr += 6;
            }
        }
        return len;
    }
    
    /** 
     * @dev Determines if a name is available for registration yet
     * 
     * Each name will be assigned a random date in which its auction 
     * can be started, from 0 to 8 weeks
     * 
     * @param _hash The hash to start an auction on
     * @param _timestamp The timestamp to query about
     */
    function isAllowed(bytes32 _hash, uint _timestamp) constant returns (bool allowed){
        return _timestamp > getAllowedTime(_hash);
    }

    /** 
     * @dev Returns available date for hash
     * 
     * The available time from the `registryStarted` for a hash is proportional
     * to its numeric value.
     * 
     * @param _hash The hash to start an auction on
     */
    function getAllowedTime(bytes32 _hash) constant returns (uint timestamp) {
        return registryStarted + ((launchLength * (uint(_hash) >> 128)) >> 128);
        // Right shift operator: a >> b == a / 2**b
    }

    /**
     * @dev Assign the owner in ENS, if we're still the registrar
     *
     * @param _hash hash to change owner
     * @param _newOwner new owner to transfer to
     */
    function trySetSubnodeOwner(bytes32 _hash, address _newOwner) internal {
        if (ens.owner(rootNode) == address(this))
            ens.setSubnodeOwner(rootNode, _hash, _newOwner);        
    }

    /**
     * @dev Start an auction for an available hash
     *
     * @param _hash The hash to start an auction on
     */
    function startAuction(bytes32 _hash) registryOpen() {
        var mode = state(_hash);
        if (mode == Mode.Auction) return;
        if (mode != Mode.Open) throw;

        entry newAuction = _entries[_hash];
        newAuction.registrationDate = now + totalAuctionLength;
        newAuction.value = 0;
        newAuction.highestBid = 0;
        AuctionStarted(_hash, newAuction.registrationDate);
    }

    /**
     * @dev Start multiple auctions for better anonymity
     *
     * Anyone can start an auction by sending an array of hashes that they want to bid for.
     * Arrays are sent so that someone can open up an auction for X dummy hashes when they
     * are only really interested in bidding for one. This will increase the cost for an
     * attacker to simply bid blindly on all new auctions. Dummy auctions that are
     * open but not bid on are closed after a week.
     *
     * @param _hashes An array of hashes, at least one of which you presumably want to bid on
     */
    function startAuctions(bytes32[] _hashes)  {
        for (uint i = 0; i < _hashes.length; i ++) {
            startAuction(_hashes[i]);
        }
    }

    /**
     * @dev Hash the values required for a secret bid
     *
     * @param hash The node corresponding to the desired namehash
     * @param value The bid amount
     * @param salt A random value to ensure secrecy of the bid
     * @return The hash of the bid values
     */
    function shaBid(bytes32 hash, address owner, uint value, bytes32 salt) constant returns (bytes32 sealedBid) {
        return sha3(hash, owner, value, salt);
    }

    /**
     * @dev Submit a new sealed bid on a desired hash in a blind auction
     *
     * Bids are sent by sending a message to the main contract with a hash and an amount. The hash
     * contains information about the bid, including the bidded hash, the bid amount, and a random
     * salt. Bids are not tied to any one auction until they are revealed. The value of the bid
     * itself can be masqueraded by sending more than the value of your actual bid. This is
     * followed by a 48h reveal period. Bids revealed after this period will be burned and the ether unrecoverable.
     * Since this is an auction, it is expected that most public hashes, like known domains and common dictionary
     * words, will have multiple bidders pushing the price up.
     *
     * @param sealedBid A sealedBid, created by the shaBid function
     */
    function newBid(bytes32 sealedBid) payable {
        if (address(sealedBids[msg.sender][sealedBid]) > 0) throw;
        if (msg.value < minPrice) throw;

        // Creates a new hash contract with the owner
        Deed newBid = (new Deed).value(msg.value)(msg.sender);
        sealedBids[msg.sender][sealedBid] = newBid;
        NewBid(sealedBid, msg.sender, msg.value);
    }

    /**
     * @dev Start a set of auctions and bid on one of them
     *
     * This method functions identically to calling `startAuctions` followed by `newBid`,
     * but all in one transaction.
     *
     * @param hashes A list of hashes to start auctions on.
     * @param sealedBid A sealed bid for one of the auctions.
     */
    function startAuctionsAndBid(bytes32[] hashes, bytes32 sealedBid) payable {
        startAuctions(hashes);
        newBid(sealedBid);
    }

    /**
     * @dev Submit the properties of a bid to reveal them
     *
     * @param _hash The node in the sealedBid
     * @param _value The bid amount in the sealedBid
     * @param _salt The sale in the sealedBid
     */
    function unsealBid(bytes32 _hash, uint _value, bytes32 _salt) {
        bytes32 seal = shaBid(_hash, msg.sender, _value, _salt);
        Deed bid = sealedBids[msg.sender][seal];
        if (address(bid) == 0) throw;

        sealedBids[msg.sender][seal] = Deed(0);
        entry h = _entries[_hash];
        uint value = min(_value, bid.value());
        bid.setBalance(value, true);

        var auctionState = state(_hash);
        if (auctionState == Mode.Owned) {
            // Too late! Bidder loses their bid. Gets 0.5% back.
            bid.closeDeed(5);
            BidRevealed(_hash, msg.sender, value, 1);
        } else if (auctionState != Mode.Reveal) {
            // Invalid phase
            throw;
        } else if (value < minPrice || bid.creationDate() > h.registrationDate - revealPeriod) {
            // Bid too low or too late, refund 99.5%
            bid.closeDeed(995);
            BidRevealed(_hash, msg.sender, value, 0);
        } else if (value > h.highestBid) {
            // New winner
            // Cancel the other bid, refund 99.5%
            if (address(h.deed) != 0) {
                Deed previousWinner = h.deed;
                previousWinner.closeDeed(995);
            }

            // Set new winner
            // Per the rules of a vickery auction, the value becomes the previous highestBid
            h.value = h.highestBid;  // will be zero if there's only 1 bidder
            h.highestBid = value;
            h.deed = bid;
            BidRevealed(_hash, msg.sender, value, 2);
        } else if (value > h.value) {
            // Not winner, but affects second place
            h.value = value;
            bid.closeDeed(995);
            BidRevealed(_hash, msg.sender, value, 3);
        } else {
            // Bid doesn't affect auction
            bid.closeDeed(995);
            BidRevealed(_hash, msg.sender, value, 4);
        }
    }

    /**
     * @dev Cancel a bid
     *
     * @param seal The value returned by the shaBid function
     */
    function cancelBid(address bidder, bytes32 seal) {
        Deed bid = sealedBids[bidder][seal];
        
        // If a sole bidder does not `unsealBid` in time, they have a few more days
        // where they can call `startAuction` (again) and then `unsealBid` during
        // the revealPeriod to get back their bid value.
        // For simplicity, they should call `startAuction` within
        // 9 days (2 weeks - totalAuctionLength), otherwise their bid will be
        // cancellable by anyone.
        if (address(bid) == 0
            || now < bid.creationDate() + totalAuctionLength + 2 weeks) throw;

        // Send the canceller 0.5% of the bid, and burn the rest.
        bid.setOwner(msg.sender);
        bid.closeDeed(5);
        sealedBids[bidder][seal] = Deed(0);
        BidRevealed(seal, bidder, 0, 5);
    }

    /**
     * @dev Finalize an auction after the registration date has passed
     *
     * @param _hash The hash of the name the auction is for
     */
    function finalizeAuction(bytes32 _hash) onlyOwner(_hash) {
        entry h = _entries[_hash];
        
        // Handles the case when there's only a single bidder (h.value is zero)
        h.value =  max(h.value, minPrice);
        h.deed.setBalance(h.value, true);

        trySetSubnodeOwner(_hash, h.deed.owner());
        HashRegistered(_hash, h.deed.owner(), h.value, h.registrationDate);
    }

    /**
     * @dev The owner of a domain may transfer it to someone else at any time.
     *
     * @param _hash The node to transfer
     * @param newOwner The address to transfer ownership to
     */
    function transfer(bytes32 _hash, address newOwner) onlyOwner(_hash) {
        if (newOwner == 0) throw;

        entry h = _entries[_hash];
        h.deed.setOwner(newOwner);
        trySetSubnodeOwner(_hash, newOwner);
    }

    /**
     * @dev After some time, or if we're no longer the registrar, the owner can release
     *      the name and get their ether back.
     *
     * @param _hash The node to release
     */
    function releaseDeed(bytes32 _hash) onlyOwner(_hash) {
        entry h = _entries[_hash];
        Deed deedContract = h.deed;
        if (now < h.registrationDate + 1 years && ens.owner(rootNode) == address(this)) throw;

        h.value = 0;
        h.highestBid = 0;
        h.deed = Deed(0);

        _tryEraseSingleNode(_hash);
        deedContract.closeDeed(1000);
        HashReleased(_hash, h.value);        
    }

    /**
     * @dev Submit a name 6 characters long or less. If it has been registered,
     *      the submitter will earn 50% of the deed value. 
     * 
     * We are purposefully handicapping the simplified registrar as a way 
     * to force it into being restructured in a few years.
     *
     * @param unhashedName An invalid name to search for in the registry.
     */
    function invalidateName(string unhashedName) inState(sha3(unhashedName), Mode.Owned) {
        if (strlen(unhashedName) > 6) throw;
        bytes32 hash = sha3(unhashedName);

        entry h = _entries[hash];

        _tryEraseSingleNode(hash);

        if (address(h.deed) != 0) {
            // Reward the discoverer with 50% of the deed
            // The previous owner gets 50%
            h.value = max(h.value, minPrice);
            h.deed.setBalance(h.value/2, false);
            h.deed.setOwner(msg.sender);
            h.deed.closeDeed(1000);
        }

        HashInvalidated(hash, unhashedName, h.value, h.registrationDate);

        h.value = 0;
        h.highestBid = 0;
        h.deed = Deed(0);
    }

    /**
     * @dev Allows anyone to delete the owner and resolver records for a (subdomain of) a
     *      name that is not currently owned in the registrar. If passing, eg, 'foo.bar.eth',
     *      the owner and resolver fields on 'foo.bar.eth' and 'bar.eth' will all be cleared.
     *
     * @param labels A series of label hashes identifying the name to zero out, rooted at the
     *        registrar's root. Must contain at least one element. For instance, to zero 
     *        'foo.bar.eth' on a registrar that owns '.eth', pass an array containing
     *        [sha3('foo'), sha3('bar')].
     */
    function eraseNode(bytes32[] labels) {
        if (labels.length == 0) throw;
        if (state(labels[labels.length - 1]) == Mode.Owned) throw;

        _eraseNodeHierarchy(labels.length - 1, labels, rootNode);
    }

    function _tryEraseSingleNode(bytes32 label) internal {
        if (ens.owner(rootNode) == address(this)) {
            ens.setSubnodeOwner(rootNode, label, address(this));
            var node = sha3(rootNode, label);
            ens.setResolver(node, 0);
            ens.setOwner(node, 0);
        }
    }

    function _eraseNodeHierarchy(uint idx, bytes32[] labels, bytes32 node) internal {
        // Take ownership of the node
        ens.setSubnodeOwner(node, labels[idx], address(this));
        node = sha3(node, labels[idx]);
        
        // Recurse if there are more labels
        if (idx > 0) {
            _eraseNodeHierarchy(idx - 1, labels, node);
        }

        // Erase the resolver and owner records
        ens.setResolver(node, 0);
        ens.setOwner(node, 0);
    }

    /**
     * @dev Transfers the deed to the current registrar, if different from this one.
     *
     * Used during the upgrade process to a permanent registrar.
     *
     * @param _hash The name hash to transfer.
     */
    function transferRegistrars(bytes32 _hash) onlyOwner(_hash) {
        var registrar = ens.owner(rootNode);
        if (registrar == address(this)) throw;

        // Migrate the deed
        entry h = _entries[_hash];
        h.deed.setRegistrar(registrar);

        // Call the new registrar to accept the transfer
        Registrar(registrar).acceptRegistrarTransfer(_hash, h.deed, h.registrationDate);

        // Zero out the entry
        h.deed = Deed(0);
        h.registrationDate = 0;
        h.value = 0;
        h.highestBid = 0;
    }

    /**
     * @dev Accepts a transfer from a previous registrar; stubbed out here since there
     *      is no previous registrar implementing this interface.
     *
     * @param hash The sha3 hash of the label to transfer.
     * @param deed The Deed object for the name being transferred in.
     * @param registrationDate The date at which the name was originally registered.
     */
    function acceptRegistrarTransfer(bytes32 hash, Deed deed, uint registrationDate) {
        hash; deed; registrationDate; // Don't warn about unused variables
    }

}
