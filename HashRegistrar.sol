/*

Hash Registrar using only Deposits
==================================

This is an attempt of setting up a name registrar that use deposits instead 
of burning or token contributions and tries to optimize name utility and 
reduce domain squatting. Previous initiatives of charging a "rent" based on 
the market price with an yearly auction proved impopular with many developers 
as they believed the registrar wasn't delivering any value for the "tax" as 
well as worries that a sudden big auction could make someone unexpectedly 
be forced to sell the name.

In order to start doing that let's define the problem:

Name squatting is defined as buying a name and not adding any value to it, 
just holding it expecting that domains names will become more valuable in 
the future. Let's assume that all name buyers have the intention of acquiring 
a name and make it more valuable over time, either by working on it as a 
business and adding value to the "brand", or by working to increase the 
chances of finding a better suited buyer, all have variable success on these 
endeavours. It's natural to assume that the value of new names being acquired 
should keep in line with the market values expectation of how profitable they 
are to sell (either as a brand, a business or a placeholder domain) in the future.

The solution here lies to require a deposit to own a name and periodically 
require the owner to update their deposit to what is assumed to be the market 
rate of the name of their current name. If names in general have increased in 
value but the owner is among the bottom half that hasn't done anything to increase 
the value of their own names, then all possible profit will be negated by the extra 
deposit. If names have decreased in value the owners can request to withdraw part 
of the deposit and the cost of the name will be the cost of opportunity of possibly 
having invested in something that would have a better return. At any point name 
holders can release and get the full deposit back.

The contract is called hash registrar because it deals with ownership of hashes of 
things, never the things themselves, to increase privacy and extensibility.

*/

contract Deed {
    /* 
    The Deed is a contract intended simply to hold ether
    It can be controlled only by the registrar and can only send ether back to the owner.
    */
    Registrar public registrar;
    address constant burn = 0xdead;
    uint public creationDate;
    address public owner;
    event OwnerChanged(address newOwner);
    event DeedClosed();
    bool active;

    modifier onlyRegistrar {
        if (msg.sender != address(registrar)) throw;
        _
    }

    modifier onlyActive {
        if (!active) throw;
        _
    }
    
    function Deed() {
        registrar = Registrar(msg.sender);
        creationDate = now;
        active = true;
    }
        
    function setOwner(address newOwner) {
        if ((owner > 0 && msg.sender != owner )
            || (owner == 0 && msg.sender != address(registrar))) throw;
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
        burn.send(((1000 - refundRatio) * this.balance)/1000);
        DeedClosed();
        destroyDeed();
    }    

    function destroyDeed() {
        if (active) throw;
        if(owner.send(this.balance)) 
            selfdestruct(burn);
    }

    /* The default function just receives an amount */
    function () {}
}

contract Registrar {
    mapping (bytes32 => entry) public entries;
    mapping (bytes32 => Deed) public sealedBids;
    
    enum Mode { Open, Auction, Owned }
    uint32 constant auctionLength = 7 days;
    uint32 constant revealPeriod = 24 hours;
    uint32 constant renewalPeriod = 1 years;
    uint32 constant maxRenewalPeriod = 8 years;
    uint32 constant M = 1000000;                    // multiplier to get more precision on averages
    uint16 constant minRatio = 100;
    uint public averagePrice = 1 ether;             // starting reference
    uint public averagePeriod;
    uint public lastSinceNewRegistry;
    uint public registryCreated;

    event AuctionStarted(bytes32 hash, uint auctionExpiryDate);
    event NewBid(bytes32 hash, uint deposit);
    event BidRevealed(bytes32 hash, address owner, uint value, uint8 status);
    event HashRegistered(bytes32 hash, address owner, uint value, uint averagePrice, uint averagePeriod);
    event HashRenewed(bytes32 hash, uint oldValue, uint newValue, uint renewalDate);
    event HashReleased(bytes32 hash, uint value);

    struct entry {
        Mode status;
        Deed deed;
        uint registrationDate;
        uint value;
        uint highestBid;
        uint lastRenewed;
        uint renewalDate;
        uint averagePrice;
    }
    
    modifier noEther {
        if (msg.value > 0) throw;
        _
    }   
    
    function Registrar() noEther {
        lastSinceNewRegistry = now;
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

    /*
    ## Start Auction for available hash

    Anyone can start an auction by sending an array of hashes that they want to bid for. 
    Arrays are sent so that someone can open up an auction for X dummy hashes when they 
    are only really interested in bidding for one. This will increase the cost for an 
    attacker from simply bidding on all new auctions blindly. Dummy auctions that are 
    open but not bid on are closed after a week. 
    */    
    function startAuction(bytes32 _hash) noEther {
        entry newAuction = entries[_hash];
        if ((newAuction.status == Mode.Owned && now < newAuction.renewalDate) 
            || (newAuction.status == Mode.Auction && now < newAuction.registrationDate))
            throw;
        
        if (newAuction.status == Mode.Owned) {
            Deed deedContract = Deed(newAuction.deed);
            deedContract.closeDeed(999);
        }
        
        // for the first five months of the registry, make longer auctions
        uint slowStart =
          (now <= registryCreated + 20 weeks) ?
          (1 + (registryCreated + 20 weeks - now) / 4 weeks) : 1;
        newAuction.registrationDate = now + auctionLength * slowStart;
        newAuction.status = Mode.Auction;  
        newAuction.value = 0;
        newAuction.highestBid = 0;
        AuctionStarted(_hash, newAuction.registrationDate);      
    }

    // Allows you to open multiple for better anonimity
    function startAuctions(bytes32[] _hashes) noEther {
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
    function newBid(bytes32 sealedBid) {
        if (address(sealedBids[sealedBid]) > 0 ) throw;
        // creates a new hash contract with the owner
        Deed newBid = new Deed();
        sealedBids[sealedBid] = newBid;
        NewBid(sealedBid, msg.value);
        if (!newBid.send(msg.value)) throw;
    } 
    
    
    /*
    ## Winning bids are deposited

    The highest bid gets control of the hash, by depositing the equivalent amount of the second 
    highest bid. The funds will be held on new contract, controlled only by the owner which 
    contains basic information like when the hash was first registered, when it needs to be 
    renewed, and the price paid for it. **The price paid is also saved on a moving average amount, 
    calculated as ```averagePrice = averagePrice * 0.999 + newPrice * 0.001```**. The 
    averagePrice at the moment of purchase is also registered on the contract.
    */ 
    function unsealBid(bytes32 _hash, address _owner, uint _value, bytes32 _salt) noEther  {
        bytes32 seal = shaBid(_hash, _owner, _value, _salt);
        Deed bid = sealedBids[seal];
        if (address(bid) == 0 ) throw;
        sealedBids[seal] = Deed(0);
        bid.setOwner(_owner);
        entry h = entries[_hash];
        
        if (bid.creationDate() > h.registrationDate - revealPeriod
            || now > h.registrationDate ) {
            // bid is invalid, burn 99%
            bid.closeDeed(10);
            BidRevealed(_hash, _owner, _value, 0);
            
        } else if ( _value < averagePrice / minRatio ) {
            // bid is invalid but not punishable, refund 99.9%
            bid.closeDeed(999);
            BidRevealed(_hash, _owner, _value, 1);
            
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
    
    function finalizeAuction(bytes32 _hash) noEther {
        entry h = entries[_hash];
        if (now < h.registrationDate 
            || h.highestBid == 0
            || h.status != Mode.Auction) throw;
        
        // set the hash
        h.status = Mode.Owned;
        h.lastRenewed = now;
        h.renewalDate = now + renewalPeriod;
        h.value =  max(h.value, averagePrice / minRatio);

        //Calculate the moving average period as a way to measure frequency
        uint period = (now - lastSinceNewRegistry) * M;
        averagePeriod = (999 * averagePeriod + period) / 1000;
        // 60 seconds is the average of 10,000 registrations per week. Use whatever's higher.
        uint n = averagePeriod < (60 seconds * M) ? 7 days * M / averagePeriod : 9999;
        averagePrice = (n*averagePrice + h.value ) / (n+1);
        h.averagePrice = averagePrice;
        lastSinceNewRegistry = now;
        
        Deed deedContract = h.deed;
        deedContract.setBalance(h.value);
        HashRegistered(_hash, deedContract.owner(), h.value, averagePrice, averagePeriod);
    }
    
    /*
    ## Renewals can be done at any moment by renewing the deposit

    In order to renew a hash you need to calculate how much have average prices of 
    hashes changed since you last bought it. If the average price hashes have increased, 
    then you need to increase your deposit. If median prices have fallen down, then 
    you have the right to withdraw part of the difference (1/2 after a year, 3/4 
    after 2 years, 7/8 after 3 years etc). 
    */ 
    function updatedValue(bytes32 _hash) constant returns (uint updatedPrice) {
        entry h = entries[_hash];
        return h.value * averagePrice / h.averagePrice;
    } 
    
    function renewDeed(bytes32 _hash) {
        entry h = entries[_hash];
        Deed deedContract = h.deed;
        uint difference = 0;
        if (h.status != Mode.Owned) throw;

        uint updatedPrice = updatedValue(_hash);
        
        if (updatedPrice > h.value) {
            difference = updatedPrice - h.value; 
            if (msg.value < difference) throw;
            deedContract.setBalance.value(msg.value)(updatedPrice);
        } else {
            difference =  h.value - updatedPrice; 
            uint ratioOfRecovery = 2**((now - h.lastRenewed)/ renewalPeriod);
            // the more time, the more you recover more from your initial investment
            deedContract.setBalance(h.value + difference - difference/ratioOfRecovery);
        }
        
        HashRenewed(_hash, h.value, updatedPrice, h.renewalDate);

        h.value = updatedPrice;
        h.lastRenewed = now;
        // Twice the current age, as long as it's betwen some max and min parameters
        uint renewalDate = min(2 * now - h.registrationDate, now + maxRenewalPeriod);
        h.renewalDate = max(renewalDate, h.registrationDate + renewalPeriod);
        h.averagePrice = averagePrice;
    }


    /*
    ## After some time, you can release the property and get your ether back

    The real cost of holding a hash is the opportunity cost of doing something better with 
    your ether. If there are better opportunities, like staking it, lending it or investing 
    in some other new venture, then holding hashes should be seen as an undesirable outcome 
    and owners have an incentive to release them. Hashes can be sold at any moment, but the 
    buyer will incur the same renewal cost/benefit analysis. 
    */ 

    function releaseDeed(bytes32 _hash) noEther  {
        entry h = entries[_hash];
        Deed deedContract = h.deed;
        if (now < h.registrationDate + renewalPeriod/2 ) throw;
        if (msg.sender != deedContract.owner() || h.status != Mode.Owned) throw;
        
        h.status = Mode.Open;
        deedContract.closeDeed(1000);
        HashReleased(_hash, h.value);
    }
    
}
