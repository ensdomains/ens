***********************************************
Registering a name with the auction registrar
***********************************************

The public ENS registry on the Ropsten testnet uses an auction registrar to hand out names on the '.eth' top level domain. This registrar implements a blind auction, and is described in EIP162_. Names are initially required to be at least 7 characters long.

Registering a name with the auction registrar is a multi-step process. First, download ensutils.js_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

Starting an auction
-------------------

Before placing a bid, you need to check if the name is available. Run this code to check:

::

    ethRegistrar.entries(web3.sha3('name'))[0]

If the returned value is `0`, the name is available, and not currently up for auction. If the returned value is `1`, the name is currently up for auction. Any other value indicates the name is not available.

To start an auction for a name that's not already up for auction, call `startAuction`:

::

    ethRegistrar.startAuction(web3.sha3('name'), {from: eth.accounts[0], gas: 100000});

You can also start auctions for several names simultaneously, to disguise which name you're actually interested in registering:

::

    ethRegistrar.startAuctions([web3.sha3('decoy1'), web3.sha3('name'), web3.sha3('decoy2')], {from: eth.accounts[0], gas: 1000000});

Auctions normally run for 1 week, but auctions that start in the first week after deployment of ENS are extended to end 2 weeks after initial deployment.

When a name is available for auction, you can check the end time of the auction as follows:

::

    new Date(ethRegistrar.entries(web3.sha3('name'))[2].toNumber() * 1000)

Placing a bid
-------------

Bids can be placed at any time during an auction except in the last 24 hours (the 'reveal period'). Before trying to place a bid, make sure an auction is currently underway, as described above, and has more than 24 hours left to run.

To bid on an open auction, you need several pieces of data:

 - The name you want to register
 - The account you want to register the name under
 - The maximum amount you're willing to pay for the name
 - A random 'salt' value

In addition, you need to decide how much Ether you want to deposit with the bid. This must be at least as much as the value of your bid, but can be more, in order to disguise the true value of the bid.

First, start by generating a secret value. An easy way to do this is to use random.org_. Store this value somewhere secure - if you lose it, you lose your deposit, and your chance at winning the auction!

Now, you can generate your 'sealed' bid, with the following code:

::

    var bid = ethRegistrar.shaBid(web3.sha3('name'), eth.accounts[0], web3.toWei(1, 'ether'), web3.sha3('secret'));

The arguments are, in order, the name you want to register, the account you want to register it under, your maximum bid, and the secret value you generated earlier.

Next, submit your bid to the registrar:

::

    ethRegistrar.newBid(bid, {from: eth.accounts[0], value: web3.toWei(2, 'ether'), gas: 500000});

In the example above, we're sending 2 ether, even though our maximum bid is 1 ether; this is to disguise the true value of our bid. When we reveal our bid later, we will get the extra 1 ether back; the most we can pay for the name is 1 ether, as we specified when generating the bid.

Now it's a matter of waiting until the reveal period before revealing your bid. Run the command to check the expiration date of the auction again, and make sure to come back in the final 24 hours of the auction:

::

    new Date(ethRegistrar.entries(web3.sha3('name'))[2].toNumber() * 1000)

Revealing your bid
------------------

In order to win an auction, you must 'reveal' your bid. This can be done at any time after you place your bid, but it's recommended you don't do so until the last 24 hours, at which point new bids are prohibited. If you don't reveal your bid by the time the auction ends, your deposit is forfeit - so make sure you store your salt in a safe place, and come back before the auction ends in order to reveal your bid.

To reveal, call the `unsealBid` function with the same values you provided earlier:

::

    ethRegistrar.unsealBid(web3.sha3('name'), eth.accounts[0], web3.toWei(1, 'ether'), web3.sha3('secret'), {from: eth.accounts[0], gas: 500000});

The arguments to `unsealBid` have the same order and meaning as those to `shaBid`, described in the bidding step.

After revealing your bid, the auction will be updated. If your bid is less than a previously revealed bid, you will be refunded the whole amount of your bid. If your bid is the largest revealed so far, you will be set as the current leading bidder, and the difference between the actual amount of your bid and the amount you sent will be refunded immediately. If you are later outbid, your bid will be sent back to you at that point.

At any time, you can check the current winning bidder with:

::

    deedContract.at(ethRegistrar.entries(web3.sha3('name'))[1]).owner();

and the value of the current winning bid with

::

    web3.fromWei(ethRegistrar.entries(web3.sha3('name'))[3], 'ether');

Finalizing the auction
----------------------

Once the auction has completed, it must be finalized in order for the name to be assigned to the winning bidder. Any user can perform this step; to do it yourself, call the `finalizeAuction` function like so:

::

    ethRegistrar.finalizeAuction(web3.sha3('name'), {from: eth.accounts[0], gas: 500000});

Once called, the winning bidder will be refunded the difference between their bid and the next highest bidder. If you're the only bidder, you get back all but 0.1 eth of your bid. The winner is then assigned the name in ENS.

If you are the winning bidder, congratulations!

.. _EIP162: https://github.com/ethereum/EIPs/issues/162
.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _random.org: https://www.random.org/strings/?num=1&len=20&digits=on&upperalpha=on&loweralpha=on&unique=off&format=html&rnd=new
