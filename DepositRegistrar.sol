// Name registrar using deposits

contract Deed {
    // The Deed is a contract intended simply to hold ether
    // It can be controlled only by the registrar and can only send ether back to the owner
    address public owner;
    address public bidder;
    Registrar public registrar;
    bytes32 public sealedBid;
    bytes32 public hashedName;
    uint public value;
    address public burn = 0xdead;
    uint public creationDate;
    
    modifier noEther {
        if (msg.value > 0) throw;
        _
    } 
    
    modifier onlyRegistrar {
        if (msg.sender != address(registrar)) throw;
        _
    }
    
    function Deed(address _bidder, bytes32 _sealedBid, address _registrar) {
        bidder = _bidder;
        registrar = Registrar(_registrar);
        sealedBid = _sealedBid;
        creationDate = now;
    }
    
    function unsealBid(bytes32 _hashedName, address _owner, uint _value, bytes32 _salt) noEther onlyRegistrar {
        if (sha3(_hashedName, _owner, _value, _salt) != sealedBid) throw;
        hashedName = _hashedName;
        owner = _owner;
        value = _value;
        if (!bidder.send(this.balance - _value)) throw;
    }
    
    function closeDeed( uint burnAmount) noEther onlyRegistrar {
        burn.send((burnAmount * this.balance)/1000);
        selfdestruct(bidder);
    }
    
    function setBalance(uint newValue) onlyRegistrar {
        // Check if it has enough balance to set the value
        if (this.balance < newValue) throw;
        // Send the difference to the owner
        if (!owner.send(this.balance - newValue)) throw;
    }
    
    function transferOwnership(address newOwner) {
        if (msg.sender != owner ) throw;
        owner = newOwner;
    }
}

contract Registrar {
    mapping (bytes32 => entry) public hashedNames;
    mapping (bytes32 => address) public sealedBids;
    
    enum Mode { Open, Auction, Owned }
    uint auctionLength = 20 minutes;
    uint revealPeriod = 5 minutes;
    uint renewalPeriod = 2 hours;
    uint M = 1000000; // just a multiplier to get more precision on averages
    uint public averagePeriod;
    uint public lastSinceNewName;
    uint public minBid = 0.1 ether;    // TODO: figure out a better way to come up with this
    uint public averagePrice = minBid;
    
    struct entry {
        Mode status;
        address deed;
        uint auctionDate;
        uint value;
        uint highestBid;
        uint firstRegistered;
        uint lastRenewed;
        uint renewalDate;
        uint averagePrice;
    }
    
    // doesnt work
    modifier withName(bytes32 nameHash){
        entry name = hashedNames[nameHash];
        _        
    }
    
    modifier noEther  {
        if (msg.value > 0) throw;
        _
    }   
    
    function Registrar() noEther  {
        lastSinceNewName = now;
    }

    /*
    ## Start Auction for available name

    Anyone can start an auction by sending an array of hashes that they want to bid for. 
    Arrays are sent so that someone can open up an auction for X dummy hashes when they 
    are only really interested in bidding for one. This will increase the cost for an 
    attacker from simply bidding on all new auctions blindly. Dummy auctions that are 
    open but not bid on are closed after a week. 
    */    
    function openAuctions(bytes32[] auctionsArray) noEther{

        for (uint i = 0; i < auctionsArray.length; i ++ ) {
            entry newAuction = hashedNames[auctionsArray[i]];
            if (newAuction.status == Mode.Owned && now < newAuction.renewalDate) {
                throw; 
            } else if (newAuction.status == Mode.Auction && now < newAuction.auctionDate) {
                throw;
            } else if (newAuction.status == Mode.Owned) {
                Deed deedContract = Deed(newAuction.deed);
                deedContract.closeDeed(1);
            }
            newAuction.auctionDate = now + auctionLength;
            newAuction.renewalDate = now + renewalPeriod;
            newAuction.status = Mode.Auction;

        }
    }
    
    function shaBid(bytes32 name, address owner, uint value, bytes32 salt) constant returns (bytes32 sealedBid) {
        return sha3(name, owner, value, salt);
    }
    
    /*
    ## One week auction for the desired hash

    Bids are sent by sending a message to the main contract with a hash and an amount. The hash 
    contains information about the bid, including the bidded hash, the bid amount, and a random 
    salt. Bids are not tied to any one auction until they are revealed. The value of the bid 
    itself can be maskeraded by changing the required period or sending more than what you are 
    bidding for. This is followed by a 24h reveal period. Bids revealed after this period will 
    be burned and the ether unrecoverable. Since this is an auction, it is expected that most 
    public names, like known domains and common dictionary words, will have multiple bidders pushing the price up. 
    */ 
    function newBid(bytes32 sealedBid) {
        if (sealedBids[sealedBid] > 0 ) throw;
        // creates a new Name contract with the owner
        address newBid = new Deed(msg.sender, sealedBid, this);
        sealedBids[sealedBid] = newBid;
        if (!newBid.send(msg.value)) throw;
    } 
    
    
    /*
    ## Winning bids are deposited

    The highest bid gets control of the name, by depositing the equivalent amount of the second 
    highest bid. The funds will be held on new contract, controlled only by the owner which 
    contains basic information like when the name was first registered, when it needs to be 
    renewed, and the price paid for it. **The price paid is also saved on a moving average amount, 
    calculated as ```averagePrice = averagePrice * 0.999 + newPrice * 0.001```**. The 
    averagePrice at the moment of purchase is also registered on the contract.
    */ 
    function revealBid(bytes32 _hashedName, address _owner, uint _value, bytes32 _salt) noEther  {
        bytes32 seal = shaBid(_hashedName, _owner, _value, _salt);
        address bidAddress = sealedBids[seal];
        if (bidAddress == 0 ) throw;
        Deed bid = Deed(bidAddress);
        bid.unsealBid(_hashedName, _owner, _value, _salt);
        entry name = hashedNames[bid.hashedName()];
        
        if (bid.creationDate() > name.auctionDate - revealPeriod
            || now > name.auctionDate ) {
            // bid is invalid, burn 99.9%
            bid.closeDeed(999);
            
        } else if ( _value < minBid ) {
            // bid is invalid but not punishable, burn 0.1%
            bid.closeDeed(1);
            
        } else if (bid.value() > name.highestBid) {
            // new winner
            // cancel the other bid, burn 0.1%
            Deed previousWinner = Deed(name.deed);
            previousWinner.closeDeed(1);
            
            // set new winner
            name.value = name.highestBid;
            name.highestBid = bid.value();
            name.deed = sealedBids[seal];
        
        } else if (bid.value() > name.value) {
            // not winner, but affects second place
            name.value = bid.value();
            bid.closeDeed(1);
            
        } else {
            // bid doesn't affect auction
            bid.closeDeed(1);
        }
    }
    
    function finalizeAuction(bytes32 nameHash) noEther {
        entry name = hashedNames[nameHash];
        if (now < name.auctionDate || name.status != Mode.Auction) throw;
        
        // set the name
        name.status = Mode.Owned;
        name.firstRegistered = now;
        name.lastRenewed = now;

        //set the averages
        uint period = (now - lastSinceNewName) * M;
        averagePeriod = (9999 * averagePeriod + period) / 10000;
        uint n = averagePeriod < (60 seconds * M) ? 7 days * M / averagePeriod : 10000;
        averagePrice = ((n-1)*averagePrice + name.value ) / n;
        name.averagePrice = averagePrice;
        lastSinceNewName = now;
        
        Deed deedContract = Deed(name.deed);
        
        deedContract.setBalance(name.value > minBid ? name.value : minBid);
    }
    
    
    /*
    ## Renewals can be done at any moment by renewing the deposit

    In order to renew a name you need to calculate how much have average prices of 
    names changed since you last bought it. If the average price names have increased, 
    then you need to increase your deposit. If median prices have fallen down, then 
    you have the right to withdraw part of the difference (1/2 after a year, 3/4 
    after 2 years, 7/8 after 3 years etc). 
    */ 
    function updatedValue(bytes32 nameHash) constant returns (uint updatedPrice) {
        entry name = hashedNames[nameHash];
        return name.value * averagePrice / name.averagePrice;
    }
    
    function renewDeed(bytes32 nameHash) {
        entry name = hashedNames[nameHash];
        if (now < name.firstRegistered + renewalPeriod/2 ) throw;
        Deed deedContract = Deed(name.deed);
        uint difference = 0;
        if (msg.sender != deedContract.owner() && name.status != Mode.Owned) throw;

        uint updatedPrice = updatedValue(nameHash);
        
        if (updatedPrice > name.value) {
            difference = updatedPrice - name.value; 
            if (msg.value < difference) throw;
            deedContract.setBalance.value(msg.value)(updatedPrice);
        } else {
            difference =  name.value - updatedPrice; 
            uint ratioOfRecovery = 2**((now - name.lastRenewed)/ 1 years);
            // the more time, the more you recover more from your initial investment
            deedContract.setBalance(name.value + difference - difference/ratioOfRecovery);
        }
        
        name.value = updatedPrice;
        name.lastRenewed = now;
        // next renewal data is twice the current age
        name.renewalDate = 2 * now - name.firstRegistered;
    }
     
    /*
    ## Renewals can be done at any moment by renewing the deposit

    The real cost of holding a name is the opportunity cost of doing something better with 
    your ether. If there are better opportunities, like staking it, lending it or investing 
    in some other new venture, then holding names should be seen as an undesirable outcome 
    and owners have an incentive to release them. Names can be sold at any moment, but the 
    buyer will incur the same renewal cost/benefit analysis. 
    */    
    function releaseDeed(bytes32 nameHash) noEther  {
        entry name = hashedNames[nameHash];
        Deed deedContract = Deed(name.deed);
        if (now < name.firstRegistered + renewalPeriod ) throw;
        if (msg.sender != deedContract.owner() && name.status != Mode.Owned) throw;
        
        name.status = Mode.Open;
        deedContract.closeDeed(0);
    }
}

























