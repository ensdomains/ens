***************************
Hosting a DNS domain on ENS
***************************

Experimental support is available for hosting DNS domains on the Ethereum blockchain via ENS. This works by configuring the domain's nameserver records to point to gateway DNS servers; these DNS servers resolve lookups by consulting an ENS registry which points to resolvers containing the zone data for the relevant domain.

The steps to host your own domain on the blockchain are:

 1. `deploy your own ENS registry`_
 2. Deploy an instance of `DNSResolver`_
 3. Update your ENS registry to set your newly deployed DNSResolver as the resolver for your domain name (eg, by calling setSubnodeOwner and setResolver; see :ref:`interacting` for details). Don't forget to set the TTL on this record to a reasonable value, or your DNS data may not get cached.
 4. Write a zonefile. The zonefile must include an NS record for your domain that specifies the resolver as *address*.ns1.ens.domains, where *address* is the address of the ENS registry you deployed in step 1, without the leading '0x'. An `example zonefile`_ is available for reference.
 5. Clone and build `ensdns`_. Start a local node, and run 'ensdns upload --keystore=path/to/keystore zonefile' to upload the zone to the blockchain.
 6. Update your NS records with your registrar to point to the name above (*address*.ns1.ens.domains).

Please note that this feature is still experimental, and shouldn't be used for anything production critical; the DNS gateway is lightly tested, and only a single instance is running at present, providing no backup or failover in case of server issues. The API and configuration may change in backwards-incompatible ways, breaking your nameserver!

.. _`deploy your own ENS registry`: deploying.html
.. _`DNSResolver`: https://github.com/ethereum/ens/blob/master/contracts/DNSResolver.sol
.. _`ensdns`: https://github.com/arachnid/ensdns/
.. _`example zonefile`: https://github.com/ethereum/ens/blob/master/ens.domains.zone
