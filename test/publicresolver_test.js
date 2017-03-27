var assert = require('assert');
var async = require('async');
var Promise = require('bluebird');

var utils = require('./utils.js');
Promise.promisifyAll(utils);
var web3 = utils.web3;
Promise.promisifyAll(web3.eth);

var accounts = null;

before(function() {
	return web3.eth.getAccountsAsync()
		.then(acct => accounts = acct);
});

describe('PublicResolver', function() {
	var resolverCode = null;
	var resolver = null;
	var ens = null;

	before(function() {
		this.timeout(10000);
		resolverCode = utils.compileContract(['interface.sol', 'PublicResolver.sol']).contracts['PublicResolver.sol:PublicResolver'];
	});

	beforeEach(function() {
		this.timeout(4000);
		return utils.deployENSAsync(accounts[0])
			.then(_ens => {
				ens = _ens;
				return new Promise(function(resolve, reject) {
					web3.eth.contract(JSON.parse(resolverCode.interface)).new(
						ens.address,
						{
							from: accounts[0],
							data: resolverCode.bytecode,
							gas: 4700000
						},
						function(err, contract) {
							if (err) {
								reject(err);
							} else if (typeof contract.address !== "undefined") {
								resolve(contract);
							} else {
								// There is to hope that reject or resolve is called
							}
						});

				});
			})
			.then(contract => {
				resolver = Promise.promisifyAll(contract);
				return ens.setSubnodeOwnerAsync(0, web3.sha3('eth'), accounts[0], {from: accounts[0]});
			});
	});

	describe('constructor', function() {

		it('should not allow a 0 address for ens');

		it('uses precise gas', function() {
			return web3.eth.getTransactionReceiptAsync(resolver.transactionHash)
				.then(receipt => assert.equal(receipt.gasUsed, 349348));
		});

	});

	describe('fallback function', function() {

		it('forbids calls to the fallback function with 0 value', function() {
			return web3.eth.sendTransactionAsync({
					from: accounts[0],
					to: resolver.address,
					gas: 3000000
				})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids calls to the fallback function with 1 value', function() {
			return web3.eth.sendTransactionAsync({
					from: accounts[0],
					to: resolver.address,
					gas: 3000000,
					value: 1
				})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('has function', function() {

		it('returns false when checking nonexistent addresses', function() {
			this.slow(400);
			return resolver.hasAsync(utils.node, "addr")
				.then(result => assert.equal(result, false));
		});

		it('returns true for previously set address', function() {
			this.slow(400);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.hasAsync(utils.node, "addr"))
				.then(has => assert.equal(has, true));
		});

		it('returns false when checking nonexistent hash', function() {
			this.slow(400);
			return resolver.hasAsync(utils.node, "hash")
				.then(result => assert.equal(result, false));
		});

		it('returns true for previously set content', function() {
			this.slow(400);
			return resolver.setContentAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.hasAsync(utils.node, "hash"))
				.then(has => assert.equal(has, true));
		});

		it('returns false for address node checked as content', function() {
			this.slow(400);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.hasAsync(utils.node, "hash"))
				.then(has => assert.equal(has, false));
		});

		it('returns false for content node checked as address', function() {
			this.slow(400);
			return resolver.setContentAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.hasAsync(utils.node, "addr"))
				.then(has => assert.equal(has, false));
		});

		it('returns false for address node checked as unknown kind', function() {
			this.slow(400);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.hasAsync(utils.node, "not a kind"))
				.then(has => assert.equal(has, false));
		});

		it('returns false for content node checked as unknown kind', function() {
			this.slow(400);
			return resolver.setContentAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.hasAsync(utils.node, "not a kind"))
				.then(has => assert.equal(has, false));
		});

	});

	describe('supportsInterface function', function() {

		it('supports both known interfaces', function() {
			this.slow(250);
			return Promise.all([
					resolver.supportsInterfaceAsync("0x3b3b57de"),
					resolver.supportsInterfaceAsync("0xd8389dc5")
				])
				.then(results => {
					assert.equal(results[0], true);
					assert.equal(results[1], true);
				});
		});

		it('does not support a random interface', function() {
			this.slow(150);
			return resolver.supportsInterfaceAsync("0x3b3b57df")
				.then(result => assert.equal(result, false));
		});

	});

	describe('setAddr function', function() {

		it('permits setting address by owner', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]});
		});

		it('can overwrite previously set address', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[0]}));
		});

		it('can overwrite to same address', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]}));
		});

		it('uses precise gas the first time', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 46163));
		});

		it('uses precise gas the second time to a different value', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[0]}))
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 31163));
		});

		it('uses precise gas the second time to the same value', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]}))
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 31163));
		});

		it('forbids setting new address by non-owners', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same address by non-owners', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing address by non-owners', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('addr function', function() {

		it('returns zero when fetching nonexistent addresses', function() {
			this.slow(200);
			return resolver.addrAsync(utils.node)
				.then(result => assert.equal(result, "0x0000000000000000000000000000000000000000"));
		});

		it('returns previously set address', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.addrAsync(utils.node))
				.then(address => assert.equal(address, accounts[1]));
		});

		it('returns overwritten address', function() {
			this.slow(300);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[0]}))
				.then(txid => resolver.addrAsync(utils.node))
				.then(address => assert.equal(address, accounts[0]));
		});

		it('uses precise gas', function() {
			this.slow(200);
			var addrTxAsync = Promise.promisify(resolver.addr.sendTransaction);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => addrTxAsync(utils.node, {from: accounts[0]}))
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 23889));
		});

	});

	describe('setContent function', function() {

		it('permits setting content by owner', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]});
		});

		it('can overwrite previously set content', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[0]}));
		});

		it('can overwrite to same content', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]}));
		});

		it('uses precise gas', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 45110));
		});

		it('uses precise gas the second time to a different value', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[0]}))
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 30110));
		});

		it('uses precise gas the second time to the same value', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]}))
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 30110));
		});

		it('forbids setting content by non-owners', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same content by non-owners', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash1', {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing content by non-owners', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('content function', function() {

		it('returns empty when fetching nonexistent content', function() {
			this.slow(200);
			return resolver.contentAsync(utils.node)
				.then(result => assert.equal(result, "0x0000000000000000000000000000000000000000000000000000000000000000"));
		});

		it('returns previously set content', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.contentAsync(utils.node))
				.then(content => assert.equal(web3.toUtf8(content), 'hash1'));
		});

		it('returns overwritten content', function() {
			this.slow(300);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[0]}))
				.then(txid => resolver.contentAsync(utils.node))
				.then(content => assert.equal(web3.toUtf8(content), 'hash2'));
		});

		it('uses precise gas', function() {
			this.slow(200);
			var contentTxAsync = Promise.promisify(resolver.content.sendTransaction);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => contentTxAsync(utils.node, {from: accounts[0]}))
				.then(web3.eth.getTransactionReceiptAsync)
				.then(receipt => assert.equal(receipt.gasUsed, 23794));
		});

	});

});
