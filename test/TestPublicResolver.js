const ENS = artifacts.require('ENSRegistry.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');

const utils = require('./helpers/Utils.js');
const namehash = require('eth-ens-namehash');

contract('PublicResolver', function (accounts) {

    let node;
    let ens, resolver;

    beforeEach(async () => {
        node = namehash('eth');
        ens = await ENS.new();
        resolver = await PublicResolver.new(ens.address);
        await ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[0], {from: accounts[0]});
    });

    describe('fallback function', async () => {

        it('forbids calls to the fallback function with 0 value', async () => {
            try {
            await web3.eth.sendTransaction({
                from: accounts[0],
                to: resolver.address,
                gas: 3000000
            })

            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('transfer did not fail');
        });        
        
        it('forbids calls to the fallback function with 1 value', async () => {
            try {
                await web3.eth.sendTransaction({
                    from: accounts[0],
                    to: resolver.address,
                    gas: 3000000,
                    value: 1
                })
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('transfer did not fail');
        });
    });

    describe('supportsInterface function', async () => {

        it('supports known interfaces', async () => {
            assert.equal(await resolver.supportsInterface("0x3b3b57de"), true);
            assert.equal(await resolver.supportsInterface("0xd8389dc5"), true);
            assert.equal(await resolver.supportsInterface("0x691f3431"), true);
            assert.equal(await resolver.supportsInterface("0x2203ab56"), true);
            assert.equal(await resolver.supportsInterface("0xc8690233"), true);
            assert.equal(await resolver.supportsInterface("0x59d1d43c"), true);
        });

        it('does not support a random interface', async () => {
            assert.equal(await resolver.supportsInterface("0x3b3b57df"), false);
        });
    });


    describe('setAddr function', async () => {

        it('permits setting address by owner', async () => {
            await resolver.setAddr(node, accounts[1], {from: accounts[0]});
            assert.equal(await resolver.addr(node), accounts[1]);
        });

        it('can overwrite previously set address', async () => {
            await resolver.setAddr(node, accounts[1], {from: accounts[0]});
            assert.equal(await resolver.addr(node), accounts[1]);

            await resolver.setAddr(node, accounts[0], {from: accounts[0]});
            assert.equal(await resolver.addr(node), accounts[0]);
        });

        it('can overwrite to same address', async () => {
            await resolver.setAddr(node, accounts[1], {from: accounts[0]});
            assert.equal(await resolver.addr(node), accounts[1]);

            await resolver.setAddr(node, accounts[1], {from: accounts[0]});
            assert.equal(await resolver.addr(node), accounts[1]);
        });

        it('forbids setting new address by non-owners', async () => {

            try {
                await resolver.setAddr(node, accounts[1], {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids writing same address by non-owners', async () => {

            await resolver.setAddr(node, accounts[1], {from: accounts[0]});

            try {
                await resolver.setAddr(node, accounts[1], {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('writing did not fail');
        });

        it('forbids overwriting existing address by non-owners', async () => {

            await resolver.setAddr(node, accounts[1], {from: accounts[0]});

            try {
                await resolver.setAddr(node, accounts[0], {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('overwriting did not fail');
        });

        it('returns zero when fetching nonexistent addresses', async () => {
            assert.equal(await resolver.addr(node), '0x0000000000000000000000000000000000000000');
        });
    });

    describe('setContent function', async () => {

        it('permits setting content by owner', async () => {
            await resolver.setContent(node, 'hash1', {from: accounts[0]});
            assert.equal(web3.toUtf8(await resolver.content(node)), 'hash1');
        });

        it('can overwrite previously set content', async () => {
            await resolver.setContent(node, 'hash1', {from: accounts[0]});
            assert.equal(web3.toUtf8(await resolver.content(node)), 'hash1');

            await resolver.setContent(node, 'hash2', {from: accounts[0]});
            assert.equal(web3.toUtf8(await resolver.content(node)), 'hash2');
        });

        it('can overwrite to same content', async () => {
            await resolver.setContent(node, 'hash1', {from: accounts[0]});
            assert.equal(web3.toUtf8(await resolver.content(node)), 'hash1');

            await resolver.setContent(node, 'hash1', {from: accounts[0]});
            assert.equal(web3.toUtf8(await resolver.content(node)), 'hash1');
        });

        it('forbids setting content by non-owners', async () => {
            try {
                await resolver.setContent(node, 'hash1', {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids writing same content by non-owners', async () => {
            await resolver.setContent(node, 'hash1', {from: accounts[0]});

            try {
                await resolver.setContent(node, 'hash1', {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('returns empty when fetching nonexistent content', async () => {
            assert.equal(
                await resolver.content(node),
                '0x0000000000000000000000000000000000000000000000000000000000000000'
            );
        });
    });

    describe('setName function', async () => {

        it('permits setting name by owner', async () => {
            await resolver.setName(node, 'name1', {from: accounts[0]});
            assert.equal(await resolver.name(node), 'name1');
        });

        it('can overwrite previously set names', async () => {
            await resolver.setName(node, 'name1', {from: accounts[0]});
            assert.equal(await resolver.name(node), 'name1');

            await resolver.setName(node, 'name2', {from: accounts[0]});
            assert.equal(await resolver.name(node), 'name2');
        });

        it('forbids setting name by non-owners', async () => {
            try {
                await resolver.setName(node, 'name2', {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }
        });

        it('returns empty when fetching nonexistent name', async () => {
            assert.equal(await resolver.name(node), '');
        });
    });
});
