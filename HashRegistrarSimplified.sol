


/*

Temporary Hash Registrar 
========================

This is a simplified version of a hash registrar. It is purporsefully limited:
names cannot be six letters or shorter, new auctions will stop after 4 years
and all ether still locked after 8 years will become unreachable.

The plan is to test the basic features and then move to a new contract in at most
2 years, when some sort of renewal mechanism will be enabled.

*/

import 'ENS.sol';


contract Deed {
    /* 
    The Deed is a contract intended simply to hold ether
    It can be controlled only by the registrar and can only send ether back to the owner.
    */
    address public registrar;
    address constant burn = 0xdead;
    uint public creationDate;
    address public owner;
    address public previousOwner;
    event OwnerChanged(address newOwner);
    event DeedClosed();
    bool active;

    modifier onlyRegistrar {
        if (msg.sender != registrar) throw;
        _
    }

    modifier onlyActive {
        if (!active) throw;
        _
    }
    
    function Deed() {
        registrar = msg.sender;
        creationDate = now;
        active = true;
    }
        
    function setOwner(address newOwner) onlyRegistrar {
        previousOwner = owner;
        owner = newOwner;
        OwnerChanged(newOwner);
    }
    
    function setBalance(uint newValue) onlyRegistrar onlyActive {
        // Check if it has enough balance to set the value
        if (this.balance < newValue) throw;
        // Send the difference to the owner
        if (!owner.send(this.balance - newValue)) throw;
    }

    function closeDeed(uint refundRatio) onlyRegistrar onlyActive {
        active = false;            
        if (! burn.send(((1000 - refundRatio) * this.balance)/1000)) throw;
        DeedClosed();
        destroyDeed();
    }    

    function destroyDeed() {
        if (active) throw;
        if(owner.send(this.balance)) 
            selfdestruct(burn);
        else throw;
    }

    /* The default function just receives an amount */
    function () {}
}

contract Registrar {
    ENS public ens;
    bytes32 public rootNode;

    mapping (bytes32 => entry) public entries;
    mapping (bytes32 => Deed) public sealedBids;
    
    enum Mode { Open, Auction, Owned, Forbidden }
    uint32 constant auctionLength = 7 days;
    uint32 constant revealPeriod = 24 hours;
    uint constant minPrice = 0.01 ether;
    uint public registryCreated;

    event AuctionStarted(bytes32 indexed hash, uint auctionExpiryDate);
    event NewBid(bytes32 indexed hash, uint deposit);
    event BidRevealed(bytes32 indexed hash, address indexed owner, uint value, uint8 status);
    event HashRegistered(bytes32 indexed hash, address indexed owner, uint value, uint now);
    event HashReleased(bytes32 indexed hash, uint value);
    event HashInvalidated(bytes32 indexed hash, string indexed name, uint value, uint now);

    struct entry {
        Mode status;
        Deed deed;
        uint registrationDate;
        uint value;
        uint highestBid;
    }

    modifier onlyOwner(bytes32 _hash) {
        entry h = entries[_hash];
        if (msg.sender != h.deed.owner() || h.status != Mode.Owned) throw;
        _
    }
    
    function Registrar(address _ens, bytes32 _rootNode) {
        ens = ENS(_ens);
        rootNode = _rootNode;

        registryCreated = now;
    }

    function max(uint a, uint b) internal constant returns (uint max) {
        if (a > b)
            return a;
        else
            return b;
    }

    function  min(uint a, uint b) internal constant returns (uint min) {
        if (a < b)
            return a;
        else
            return b;
    }

    function strlen(string s) internal constant returns (uint) {
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
            } else if(b < 0xE0) {
                ptr += 2;
            } else if(b < 0xF0) {
                ptr += 3;
            } else if(b < 0xF8) {
                ptr += 4;
            } else if(b < 0xFC) {
                ptr += 5;
            } else {
                ptr += 6;
            }
        }
        return len;
    }

    /*
    ## Start Auction for available hash

    Anyone can start an auction by sending an array of hashes that they want to bid for. 
    Arrays are sent so that someone can open up an auction for X dummy hashes when they 
    are only really interested in bidding for one. This will increase the cost for an 
    attacker from simply bidding on all new auctions blindly. Dummy auctions that are 
    open but not bid on are closed after a week. 
    */    
    function startAuction(bytes32 _hash) {
        entry newAuction = entries[_hash];
        if ((newAuction.status == Mode.Auction && now < newAuction.registrationDate)
            || newAuction.status == Mode.Owned 
            || newAuction.status == Mode.Forbidden
            || now > registryCreated + 4 years)
            throw;
        
        // for the first month of the registry, make longer auctions
        newAuction.registrationDate = max(now + auctionLength, registryCreated + 4 weeks);
        newAuction.status = Mode.Auction;  
        newAuction.value = 0;
        newAuction.highestBid = 0;
        AuctionStarted(_hash, newAuction.registrationDate);      
    }

    // Allows you to open multiple for better anonimity
    function startAuctions(bytes32[] _hashes)  {
        for (uint i = 0; i < _hashes.length; i ++ ) {
            startAuction(_hashes[i]);
        }
    }
    
    function shaBid(bytes32 hash, address owner, uint value, bytes32 salt) constant returns (bytes32 sealedBid) {
        return sha3(hash, owner, value, salt);
    }
    
    /*
    ## Blind auction for the desired hash

    Bids are sent by sending a message to the main contract with a hash and an amount. The hash 
    contains information about the bid, including the bidded hash, the bid amount, and a random 
    salt. Bids are not tied to any one auction until they are revealed. The value of the bid 
    itself can be masqueraded by changing the required period or sending more than what you are 
    bidding for. This is followed by a 24h reveal period. Bids revealed after this period will 
    be burned and the ether unrecoverable. Since this is an auction, it is expected that most 
    public hashes, like known domains and common dictionary words, will have multiple bidders pushing the price up. 
    */ 
    function newBid(bytes32 sealedBid) payable {
        if (address(sealedBids[sealedBid]) > 0 ) throw;
        // creates a new hash contract with the owner
        Deed newBid = new Deed();
        sealedBids[sealedBid] = newBid;
        NewBid(sealedBid, msg.value);
        if (!newBid.send(msg.value)) throw;
    } 
    
    /*
    ## Winning bids are locked
    */ 
    function unsealBid(bytes32 _hash, address _owner, uint _value, bytes32 _salt) {
        bytes32 seal = shaBid(_hash, _owner, _value, _salt);
        Deed bid = sealedBids[seal];
        if (address(bid) == 0 ) throw;
        sealedBids[seal] = Deed(0);
        bid.setOwner(_owner);
        entry h = entries[_hash];
        
        if (h.status == Mode.Forbidden) {
            // Bid was found to be on a short name, refund fully
            bid.closeDeed(1000);
        } else if (bid.creationDate() > h.registrationDate - revealPeriod
            || now > h.registrationDate 
            || _value < minPrice) {
            // bid is invalid, burn 99%
            bid.closeDeed(10);
            BidRevealed(_hash, _owner, _value, 0);
            
        } else if (_value > h.highestBid) {
            // new winner
            // cancel the other bid, refund 99.9%
            Deed previousWinner = h.deed;
            previousWinner.closeDeed(999);
            
            // set new winner
            h.value = h.highestBid;
            h.highestBid = _value;
            h.deed = bid;
            bid.setBalance(_value);
            BidRevealed(_hash, _owner, _value, 2);
        
        } else if (_value > h.value) {
            // not winner, but affects second place
            h.value = _value;
            bid.closeDeed(999);
            BidRevealed(_hash, _owner, _value, 3);
            
        } else {
            // bid doesn't affect auction
            bid.closeDeed(999);
            BidRevealed(_hash, _owner, _value, 4);
        }
    }
    
    function cancelBid(bytes32 seal) {
        Deed bid = sealedBids[seal];
        // If the bid hasn't been revealed long after any possible auction date, then close it
        if (address(bid) == 0 || now < bid.creationDate() + auctionLength * 12 || bid.owner() > 0) throw; 
        // There is a fee for cleaning an old bid, but it's smaller than revealing it
        bid.setOwner(msg.sender);
        bid.closeDeed(5);
        sealedBids[seal] = Deed(0);
        BidRevealed(seal, 0, 0, 5);
    }
    
    function finalizeAuction(bytes32 _hash) {
        entry h = entries[_hash];
        if (now < h.registrationDate 
            || h.highestBid == 0
            || h.status != Mode.Auction) throw;
        
        // set the hash
        h.status = Mode.Owned;
        h.value =  max(h.value, minPrice);

        // Assign the owner in ENS
        ens.setSubnodeOwner(rootNode, _hash, h.deed.owner());

        Deed deedContract = h.deed;
        deedContract.setBalance(h.value);
        HashRegistered(_hash, deedContract.owner(), h.value, now);
    }

    /*
    ## The owner of a domain may transfer it to someone else at any time.
    */
    function transfer(bytes32 _hash, address newOwner) onlyOwner(_hash) {
        entry h = entries[_hash];
        h.deed.setOwner(newOwner);
        ens.setSubnodeOwner(rootNode, _hash, newOwner);
    }

    /*
    ## After some time, you can release the property and get your ether back
    */ 

    function releaseDeed(bytes32 _hash) onlyOwner(_hash) {
        entry h = entries[_hash];
        Deed deedContract = h.deed;
        if (now < h.registrationDate + 1 years 
        || now > registryCreated + 8 years) throw;
        
        h.status = Mode.Open;
        ens.setSubnodeOwner(rootNode, _hash, 0);
        deedContract.closeDeed(1000);
        HashReleased(_hash, h.value);
    }  

    /*
    Names on the simplified registrar can't be six letters or less. We are purposefully
    handicapping its usefulness as a way to force it into being restructured in a few years
    */
    function invalidateName(string unhashedName) {
        if (strlen(unhashedName) > 6 ) throw;
        bytes32 hash = sha3(unhashedName);
        
        entry h = entries[hash];
        h.status = Mode.Forbidden;
        ens.setSubnodeOwner(rootNode, hash, 0);
        if(address(h.deed) != 0) {
            // Reward the discoverer with 10% of the deed
            h.deed.setOwner(msg.sender);
            h.deed.closeDeed(100);
        }
        HashInvalidated(hash, unhashedName, h.value, now);
    }


}
