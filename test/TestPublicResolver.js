const ENS = artifacts.require('ENSRegistry.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');

const utils = require('./helpers/Utils.js');
const namehash = require('eth-ens-namehash');
const web3Utils = require('web3-utils');

contract('PublicResolver', function (accounts) {

    let node;
    let ens, resolver;

    beforeEach(async () => {
        node = namehash('eth');
        ens = await ENS.new();
        resolver = await PublicResolver.new(ens.address);
        await ens.setSubnodeOwner('0x0', web3Utils.sha3('eth'), accounts[0], {from: accounts[0]});
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


    describe('addr', async () => {

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

    describe('content', async () => {

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

    describe('name', async () => {

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

    describe('pubkey', async () => {

        it('returns empty when fetching nonexistent values', async () => {
            assert.deepEqual(await resolver.pubkey(node), [
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000000000000000000000000000"]
            );
        });

        it('permits setting public key by owner', async () => {
            await resolver.setPubkey(node, 1, 2, {from: accounts[0]});
            assert.deepEqual(await resolver.pubkey(node), [
                "0x1000000000000000000000000000000000000000000000000000000000000000",
                "0x2000000000000000000000000000000000000000000000000000000000000000"]
            );
        });

        it('can overwrite previously set value', async () => {
            await resolver.setPubkey(node, 1, 2, {from: accounts[0]});
            await resolver.setPubkey(node, 3, 4, {from: accounts[0]});
            assert.deepEqual(await resolver.pubkey(node), [
                "0x3000000000000000000000000000000000000000000000000000000000000000",
                "0x4000000000000000000000000000000000000000000000000000000000000000"]
            );
        });

        it('can overwrite to same value', async () => {
            await resolver.setPubkey(node, 1, 2, {from: accounts[0]});
            await resolver.setPubkey(node, 1, 2, {from: accounts[0]});
            assert.deepEqual(await resolver.pubkey(node), [
                "0x1000000000000000000000000000000000000000000000000000000000000000",
                "0x2000000000000000000000000000000000000000000000000000000000000000"]
            );
        });

        it('forbids setting value by non-owners', async () => {

            try {
                await resolver.setPubkey(node, 1, 2, {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids writing same value by non-owners', async () => {
            await resolver.setPubkey(node, 1, 2, {from: accounts[0]});

            try {
                await resolver.setPubkey(node, 1, 2, {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids overwriting existing value by non-owners', async () => {
            await resolver.setPubkey(node, 1, 2, {from: accounts[0]});

            try {
                await resolver.setPubkey(node, 3, 4, {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });
    });

    describe('ABI', async () => {
        it('returns a contentType of 0 when nothing is available', async () => {
            let result = await resolver.ABI(node, 0xFFFFFFFF);
            assert.deepEqual([result[0].toNumber(), result[1]], [0, "0x"]);
        });

        it('returns an ABI after it has been set', async () => {
            await resolver.setABI(node, 0x1, '0x666f6f', {from: accounts[0]})
            let result = await resolver.ABI(node, 0xFFFFFFFF);
            assert.deepEqual([result[0].toNumber(), result[1]], [1, "0x666f6f"]);
        });

        it('returns the first valid ABI', async () => {
            await resolver.setABI(node, 0x2, "0x666f6f", {from: accounts[0]});
            await resolver.setABI(node, 0x4, "0x626172", {from: accounts[0]});

            let result = await resolver.ABI(node, 0x7);
            assert.deepEqual([result[0].toNumber(), result[1]], [2, "0x666f6f"]);

            result = await resolver.ABI(node, 0x5);
            assert.deepEqual([result[0].toNumber(), result[1]], [4, "0x626172"]);
        });

        it('allows deleting ABIs', async () => {
            await resolver.setABI(node, 0x1, "0x666f6f", {from: accounts[0]})
            let result = await resolver.ABI(node, 0xFFFFFFFF);
            assert.deepEqual([result[0].toNumber(), result[1]], [1, "0x666f6f"]);

            await resolver.setABI(node, 0x1, "", {from: accounts[0]})
            result = await resolver.ABI(node, 0xFFFFFFFF);
            assert.deepEqual([result[0].toNumber(), result[1]], [0, "0x"]);
        });

        it('rejects invalid content types', async () => {
            try {
                await resolver.setABI(node, 0x3, "foo", {from: accounts[0]})
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids setting value by non-owners', async () => {

            try {
                await resolver.setABI(node, 0x1, "0x666f6f", {from: accounts[1]})
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });
    });

    describe('text', async () => {
        var url = "https://ethereum.org";
        var url2 = "https://github.com/ethereum";

        it('permits setting text by owner', async () => {
            await resolver.setText(node, "url", url, {from: accounts[0]});
            assert.equal(await resolver.text(node, "url"), url);
        });

        it('can overwrite previously set text', async () => {
            await resolver.setText(node, "url", url, {from: accounts[0]});
            assert.equal(await resolver.text(node, "url"), url);

            await resolver.setText(node, "url", url2, {from: accounts[0]});
            assert.equal(await resolver.text(node, "url"), url2);
        });

        it('can overwrite to same text', async () => {
            await resolver.setText(node, "url", url, {from: accounts[0]});
            assert.equal(await resolver.text(node, "url"), url);

            await resolver.setText(node, "url", url, {from: accounts[0]});
            assert.equal(await resolver.text(node, "url"), url);
        });

        it('forbids setting new text by non-owners', async () => {
            try {
                await resolver.setText(node, "url", url, {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids writing same text by non-owners', async () => {
            await resolver.setText(node, "url", url, {from: accounts[0]});

            try {
                await resolver.setText(node, "url", url, {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });
    });

    describe('multihash', async () => {

        it('permits setting multihash by owner', async () => {
            await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000001', {from: accounts[0]});
            assert.equal(await resolver.multihash(node), '0x0000000000000000000000000000000000000000000000000000000000000001');
        });

        it('can overwrite previously set multihash', async () => {
            await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000001', {from: accounts[0]});
            assert.equal(await resolver.multihash(node), '0x0000000000000000000000000000000000000000000000000000000000000001');

            await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000002', {from: accounts[0]});
            assert.equal(await resolver.multihash(node), '0x0000000000000000000000000000000000000000000000000000000000000002');
        });

        it('can overwrite to same multihash', async () => {
            await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000001', {from: accounts[0]});
            assert.equal(await resolver.multihash(node), '0x0000000000000000000000000000000000000000000000000000000000000001');

            await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000002', {from: accounts[0]});
            assert.equal(await resolver.multihash(node), '0x0000000000000000000000000000000000000000000000000000000000000002');
        });

        it('forbids setting multihash by non-owners', async () => {
            try {
                await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000001', {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('forbids writing same multihash by non-owners', async () => {
            await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000001', {from: accounts[0]});

            try {
                await resolver.setMultihash(node, '0x0000000000000000000000000000000000000000000000000000000000000001', {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('setting did not fail');
        });

        it('returns empty when fetching nonexistent multihash', async () => {
            assert.equal(
                await resolver.multihash(node),
                '0x'
            );
        });
    });

});
