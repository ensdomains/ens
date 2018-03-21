const FIFSRegistrar = artifacts.require('FIFSRegistrar.sol');
const ENS = artifacts.require('ENSRegistry.sol');

const utils = require('./helpers/Utils.js');
const web3Utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

contract('FIFSRegistrar', function (accounts) {

    let registrar, ens;

    beforeEach(async () => {
        ens = await ENS.new();
        registrar = await FIFSRegistrar.new(ens.address, 0);

        await ens.setOwner(0, registrar.address, {from: accounts[0]})
    });

    it('should allow registration of names', async () => {
        await registrar.register(web3Utils.sha3('eth'), accounts[0], {from: accounts[0]});
        assert.equal(await ens.owner(0), registrar.address);
        assert.equal(await ens.owner(namehash('eth')), accounts[0]);
    });

    describe('transferring names', async () => {

        beforeEach(async () => {
            await registrar.register(web3Utils.sha3('eth'), accounts[0], {from: accounts[0]});
        });

        it('should allow transferring name to your own', async () => {
            await registrar.register(web3Utils.sha3('eth'), accounts[1], {from: accounts[0]});
            assert.equal(await ens.owner(namehash('eth')), accounts[1]);
        });

        it('forbids transferring the name you do not own', async () => {
            try {
                await registrar.register(web3Utils.sha3('eth'), accounts[1], {from: accounts[1]});
            } catch (error) {
                return utils.ensureException(error);
            }

            assert.fail('transfer did not fail');
        });
    });
});

