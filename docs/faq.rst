*****
FAQ
*****

Why are names registered as hashes? 
-----------------------------------

Hashes are used for two main reasons. First, to prevent trivial enumeration of the entire set of domains, which helps preserve privacy of names (for instance, so you can register the domain for your startup before you publicly launch). Second, because hashes provide a fixed length identifier that can easily be passed around between contracts with fixed overhead and no issues around passing around variable-length strings.

Can I register a TLD of my own in the ENS?
-----------------------------------

No, TLDs are restricted to only .eth (on mainnet), or .eth and .test (on Ropsten), plus any special purpose TLDs such as those required to permit reverse lookups. There are no immediate plans to invite proposals for additional TLDs. In large part this is to reduce the risk of a namespace collision with the IANA DNS namespace.

Instead of burning funds in the auction for bidding costs and penalties, shouldn’t they be donated to the Ethereum Foundation?
-----------------------------------

Burning is fairly rare in the current registrar; it only burns fees if you reveal an illegal bid, or fail to reveal a bid during the reveal period. In all other circumstances they’re refunded to users, either when you’re outbid or when you relinquish the name. A small portion (0.1%) of the bids are burned with the intent of creating a cost for a large amount of domains or for highly valuable domains without the intention of buying them.

Burning fees is impartial, and avoids both political concerns over the destination of the funds, and perverse incentives for the beneficiary of the fees. The value of the ether burned is not destroyed, but rather equally distributed among all ether holders.

Who will own the ENS rootnode?  What powers does that grant them?
-----------------------------------

The root node will initially be owned by a multisig contract, with keys held by trustworthy individuals in the Ethereum community. The exact makeup of this has not yet been decided on. We expect that this will be very hands-off, with the root ownership only used to effect administrative changes, such as the introduction of a new TLD, or to recover from an emergency such as a critical vulnerability in a TLD registrar.

In the long term, the plan is to define a governance process for operations on the root node, and transfer ownership to a contract that enforces this process. 

Since the owner of a node can change ownership of any subnode, the owner of the root can change any node in the ENS tree.

What about foreign characters? What about upper case letters? Is any unicode character valid? 
-----------------------------------

Since the ENS contracts only deal with hashes, they have no direct way to enforce limits on what can be registered; character length restrictions are implemented by allowing users to challenge a short name by providing its preimage to prove it’s too short.

This means that you can in theory register both ‘foo.eth’ and ‘FOO.eth’, or even <picture of my cat>.eth. However, resolvers such as browsers and wallets should apply the nameprep algorithm to any names users enter before resolving; as a result, names that are not valid outputs of nameprep will not be resolvable by standard resolvers, making them effectively useless. DApps that assist users with registering names should prevent users from registering unresolvable names by using nameprep to preprocess names being requested for registration. 

Nameprep isn't enforced in the ENS system, is this a security/spoofing/phishing concern? 
-----------------------------------

It’s not enforced by the ENS contracts, but as described, resolvers are expected to use it before resolving names. This means that non-nameprep names will not be resolvable.

How was the minimum character length of 7 chosen?
-----------------------------------

By an informal survey of common ‘high value’ short names. This restriction is intended to be lifted once the permanent registrar is in place.

What values will the permanent registrar try to optimize for? 
-----------------------------------

This is something that the community will have to decide as part of the standardisation process for the permanent registrar. A few possible principles to consider include:

 - Accessibility: Registering a new name should be as easy and straightforward as possible.
 - Correct valuation: registering a known or popular name should be costly and intentional, not a matter of luck
 - Fairness: The system should not unduly favor people who happen to be in the right place at the right time.
 - Stability: Names should only be reallocated with the express will of the owner or according to objective rules that will be discussed and set with the whole community.
 - Principle of least surprise: Wherever possible, names should resolve to the resource most users would expect it to resolve to.

What kinds of behaviours are likely to result in losing ownership of a name?
-----------------------------------

This is the most important aspect to be decided on the Permanent registrar and the one we want more open debate. At minimum we want the owner of a name to have to execute some periodical transaction, just to prove that name hasn’t been abandoned or keys have been lost. This transaction would probably also require additional ether to be locked or burned. The method to which that amount is calculated is yet to be determined but would probably be dependent on some (but not necessarily all) of these factors:

 - The amount of ethers the domain was bought for originally
 - The average cost of a domain back when it was first bought 
 - The average cost of a domain at the moment of renewal
 - The current market value of the domain (to be calculated with some auction method)
 - Other factors to be discussed

Just like the current model, this “fee” would not go to the Ethereum Foundation or any third party, but be locked or burned. Ideally, this financial (opportunity and liquidity) cost will make name squatting unprofitable – or at least make the name reselling market a dynamic and competitive one, focused on quick turnout and not on holding names long term for as much money as possible.

Another very possible option creating some sort of dispute resolution process for names, to ensure the “principle of least surprise” but this is a controversial idea and there are no clear ideas on how this process could be achieved in a fair way without risks of centralization and abuse of power.