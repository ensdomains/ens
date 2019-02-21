****************************
The .eth permanent registrar
****************************

Introduction
------------

The Permanent Registrar is the code that will govern allocation and renewal of names in the .eth TLD. Presently this is governed by the legacy auction registrar, which uses a Vickery Auction process to allocate names to registrants. The new registrar aims to simplify this process, while providing a stable platform for future improvements that will minimise API changes.

The target deployment date for the permanent registrar is the 4th of May, 2019. Documentation provided here is preliminary, and intended to provide developers wanting to integrate .eth domain registration or renewal into their platforms or tools with a starting point.

This document assumes you have a basic understanding of the architecture of ENS. :ref:`introduction` gives an overview of this.

Terminology
-----------

 - *Name*: An ENS identifier. Names may consist of multiple parts, called labels, separated by dots.
 - *Label*: An individual component of a name.
 - *Labelhash*: The keccak-256 hash of an individual label.
 - *Namehash*: The algorithm used to process an ENS name and return a cryptographic hash uniquely identifying that name. Namehash takes a name as input and produces a *node*.
 - *Node*: A cryptographic hash uniquely identifying a name.
 - *Owner*: The owner of a name is the entity referenced in the ENS registry's `owner` field. An owner may transfer ownership, set a resolver or TTL, and create or reassign subdomains.
 - *Registry*: The core contract of ENS, the registry maintains a mapping from domain name (at any level - x, y.x, z.y.x etc) to owner, resolver, and time-to-live.
 - *Resolver*: A resolver is a contract that maps from name to resource (eg, Ethereum account address, public key, content hash, etc). Resolvers are pointed to by the `resolver` field of the registry.
 - *Registrar*: A registrar is a contract responsible for allocating subdomains. Registrars can be configured at any level of ENS, and are pointed to by the `owner` field of the registry.
 - *Registration*: A registration is the system's record of a user's ownership of a name. This is distinct from name ownership; registrations are maintained in the registrar contract and additionally store information on expiry date, rent paid, etc.
 - *Registrant*: The owner of a registration. The registrant may transfer the registration, pay rent ('renew' the name), and reclaim ownership of the name in the registry if required.

System architecture
-------------------

Code for the permanent registrar can be found in the ethregistrar_ repository.

The registrar itself is called BaseRegistrar_. This contract implements several key functions:

- The owner of the registrar may add and remove 'controllers'.
- Controllers may register new domains and extend the expiry of (renew) existing domains. They can not change the ownership or reduce the expiration time of existing domains.
- Name owners may transfer ownership to another address.
- Name owners may reclaim ownership in the ENS registry if they have lost it.
- Owners of names in the legacy registrar may transfer them to the new registrar, during the 1 year transition period. When they do so, their deposit is returned to them in its entirety.

In addition, the registrar is an ERC721_ compliant nonfungeable token contract, meaning that .eth registrations can be transferred in the same fashion as other NFTs.

Users will interact directly with this contract when transferring ownership of names, or recovering ownership in the ENS registry of a name (for example, one whose ownership was previously transferred to a contract). Users can also query names to see their registration status and expiry date. For initial registration and for renewals, users will need to interact with a controller contract.

This separation of concerns reduces the attack surface for the registrar, and provides users with guarantees of continued ownership of a name so long as the registrar is in place. Simultaneously, it provides for improvement and innovation over registration and renewal mechanisms. A future update may transfer ownership of the root and the .eth TLD to a contract with restricted permissions, thus preventing even the root keyholders from modifying a .eth registraion, while still providing for future updates to the set of controllers.

Initially, one controller is implemented, the ETHRegistrarController_. This controller provides a straightforward registration and renewal mechanism for domains that are 7 or more characters long, implementing the following functionality:

- The owner of the controller may set a price oracle contract, which determines the cost of registrations and renewals based on the name and the desired registration or renewal duration.
- The owner of the controller may withdraw any collected funds to their account.
- Users can register new names using a commit/reveal process and by paying the appropriate registration fee.
- Users can renew a name by paying the appropriate fee. Any user may renew a domain, not just the name's owner. There is no limit on renewal duration.

By allowing anyone to renew a domain, users concerned with the longevity of a name they interact with can ensure it remains registered by paying for the registration themselves, if necessary.

By allowing renewal for arbitrarily long periods of time, users can 'lock in' a desirable registration fee. Names can be made  effectively 'immortal' by renewing for a long period, ensuring that stability of the name can be guaranteed by smart contract.

Users will interact with this controller for registering domains 7+ characters long, and for renewing any domain. After the restriction on name length has been relaxed and an auction has been conducted for initial allocation of shorter names, a revised version of this controller will be deployed, allowing registration of shorter names as well.

Initially, a single pricing oracle will be deployed, the StablePriceOracle_. This contract permits its owner to set prices in USD for each permitted name length, and uses a USD:ETH price oracle to convert those prices into Ether at the current rate. Users will not have to interact with this oracle directly, as the controller provides functionality to determine pricing for a candidate name registration or renewal.

Registrar Interface
-------------------

This section documents the parts of the registrar interface relevant to implementers of tools that interact with it. Functionality exclusive to the registrar owner or to controllers is omitted for brevity.

    event ControllerAdded(address indexed controller);
    event ControllerRemoved(address indexed controller);
    
The ``ControllerAdded`` and ``ControllerRemoved`` events allow watchers to determine the list of currently valid controllers.

::

    event NameMigrated(uint256 indexed hash, address indexed owner, uint expires);

The ``NameMigrated`` event is emitted when a registration is migrated over from the legacy registrar.

::

    event NameRegistered(uint256 indexed hash, address indexed owner, uint expires);
    event NameRenewed(uint256 indexed hash, uint expires);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

The ``NameRegistered`` event is emitted when a new registration is made. ``NameRenewed`` is emitted when a registration's expiry is extended. ``Transfer`` is part of ERC721_ and is emitted when the owner address of a name is changed.

::

    bytes32 public baseNode;

``baseNode`` is the namehash of the name that this registrar handles registrations for - ``namehash('eth')`` for the deployed registrar.

The registrar works exclusively with label hashes - the ``keccak256`` of the first component of the label (eg, ``keccak256('ens')`` for ``ens.eth``). For compatibility with ERC721, these are expressed as `uint256` values rather than `bytes32`, but can be cast backwards and forwards transparently. The namehash of a name can be derived by computing ``keccak256(baseNode, labelHash)``.

::

    uint public transferPeriodEnds;

``transferPeriodEnds`` documents the unix timestamp at which it is no longer possible to migrate over registrations from the legacy registrar, and any non-migrated registrations become available for registration by anyone.

::

    mapping(address=>bool) public controllers;

``controllers`` allows callers to check if the supplied address is authorised as a registrar controller.

::

    function ownerOf(uint256 label) external view returns(address);

``ownerOf`` returns the address that owns the registration identified by the label hash, or reverts if the registration does not exist. Registrations that have not yet been migrated from the legacy registrar are treated the same as registrations that do not exist. This function is part of ERC721_.

::

    function nameExpires(uint256 label) external view returns(uint);

Returns the unix timestamp at which a registration currently expires. Names that do not exist or are not yet mirated from the legacy registrar will return 0.

::

    function available(uint256 label) public view returns(bool);

Returns true if a name is available for registration. Takes into account not-yet-migrated registrations from the legacy registrar. Registrar controllers may impose more restrictions on registrarions than this contract (for example, a minimum name length), so this function should not be used to check if a name can be registered by a user.

::

    function transferFrom(address from, address to, uint256 tokenId) public;
    function safeTransferFrom(address from, address to, uint256 tokenId) public;

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public;

These functions transfer the registration. They behave as specified in ERC721_.

::

    function approve(address to, uint256 tokenId) public;
    function getApproved(uint256 tokenId) public view returns (address operator);

    function setApprovalForAll(address operator, bool _approved) public;
    function isApprovedForAll(address owner, address operator) public view returns (bool);

These functions manage approvals as documented in ERC721_.

::

    function reclaim(uint256 label) external;

Sets the owner record of the name in the ENS registry to match the owner of the registration in this registry. May only be called by the owner of the registration.

Controller Interface
--------------------

This section documents the parts of the ETHRegistrarController_ relevant to implementers of tools that interact with it. Functionality exclusive to the registrar owner is omitted for brevity.

The controller works exclusively with plaintext labels (eg, 'ens' for 'ens.eth').

To prevent frontrunning, the ETHRegistrarController requires a commit/reveal process for new name registrations (but not for  renewals). To register a name, the user must:

1. Generate a commitment hash from the name they want to register and a secret value.
2. Submit the commitment hash from #1 to the controller.
3. Wait for at least 10 minutes, but no longer than 24 hours.
4. Submit a registration request for the name, along with the secret value from #1.

This process ensures that registrations cannot be frontrun unless the attacker is able to censor the user's transactions for at least 10 minutes.

::

    uint constant public MIN_COMMITMENT_AGE;
    uint constant public MAX_COMMITMENT_AGE;
    uint constant public MIN_REGISTRATION_DURATION;

These public constants set the minimum and maximum age of commitments, and the minimum valid duration for a name registration.

::

    event NameRegistered(string name, bytes32 indexed label, address indexed owner, uint cost, uint expires);
    event NameRenewed(string name, bytes32 indexed label, uint cost, uint expires);

These events record when a name was registered or renewed. In contrast to the corresponding events on the Registrar, these are only triggered for registrations and renewals made using this controller. However, they contain additional information not available to the Registrar: The plaintext label (eg, 'ens' in the case of 'ens.eth') and the cost of the registration or renewal.

::

    mapping(bytes32=>uint) public commitments;

``commitments`` stores a mapping from each submitted to commitment to the timestamp at which it was made. Callers wishing to validate that a commitment is valid before submitting a registration transaction should check this map first.

::

    function rentPrice(string name, uint duration) view public returns(uint);

``rentPrice`` returns the cost, in wei, to register or renew the provided name for the provided duration. Callers should note that this price may vary over time, particularly if the pricing oracle is relying on a fiat price conversion.

::

    function valid(string name) public view returns(bool);

``valid`` returns true iff name is valid for registration with this controller (eg, it meets length requirements).

::

    function available(string name) public view returns(bool);

``available`` returns true iff the name is both valid and available for registration by this controller.

::

    function makeCommitment(string name, bytes32 secret) pure public returns(bytes32);

``makeCommitment`` generates a commitment hash from a name label (eg, 'myname', not 'myname.eth') and secret value.

::

    function commit(bytes32 commitment) public;

``commit`` submits a precommitment generated by calling ``makeCommitment`` locally.

::

    function register(string name, address owner, uint duration, bytes32 secret) public payable;

``register`` registers a name. A valid registration request must meet the following criteria:

1. ``available(name) == true``.
2. ``duration >= MIN_REGISTRATION_DURATION``.
3. ``secret`` identifies a valid commitment (eg, ``commitments[keccak256(keccak256(name), secret)]`` exists and is between 10 minutes and 24 hours old.
4. ``msg.value >= rentPrice(name, duration)``.

Because the rent price may vary over time, callers are recommended to send slightly more than the value returned by ``rentPrice`` - a premium of 5-10% will likely be sufficient. Any excess funds are returned to the caller.

::

    function renew(string name, uint duration) external payable;

``renew`` renews a name. This function can be called by anyone, as long as sufficient funds are provided. Because the rent price may vary over time, callers are recommended to send slightly more than the value returned by ``rentPrice`` - a premium of 5-10% will likely be sufficient. Any excess funds are returned to the caller.

.. _ethregistrar: https://github.com/ensdomains/ethregistrar
.. _BaseRegistrar: https://github.com/ensdomains/ethregistrar/blob/master/contracts/BaseRegistrarImplementation.sol
.. _ETHRegistrarController: https://github.com/ensdomains/ethregistrar/blob/master/contracts/ETHRegistrarController.sol
.. _StablePriceOracle: https://github.com/ensdomains/ethregistrar/blob/master/contracts/StablePriceOracle.sol
