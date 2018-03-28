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
		resolverCode = utils.compileContract(['AbstractENS.sol', 'PublicResolver.sol']).contracts['PublicResolver.sol:PublicResolver'];
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

	describe('ABI', function() {
		it('returns a contentType of 0 when nothing is available', function() {
			return resolver.ABIAsync(utils.node, 0xFFFFFFFF)
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [0, "0x"]));
		});

		it('returns an ABI after it has been set', function() {
			return resolver.setABIAsync(utils.node, 0x1, "foo", {from: accounts[0]})
				.then(txid => resolver.ABIAsync(utils.node, 0x1))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [1, "0x666f6f"]));
		});

		it('returns the first valid ABI', function() {
			return resolver.setABIAsync(utils.node, 0x2, "foo", {from: accounts[0]})
				.then(txid => resolver.setABIAsync(utils.node, 0x4, "bar", {from: accounts[0]}))
				.then(txid => resolver.ABIAsync(utils.node, 0x7))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [2, "0x666f6f"]))
				.then(result => resolver.ABIAsync(utils.node, 0x5))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [4, "0x626172"]));
		});

		it('allows deleting ABIs', function() {
			return resolver.setABIAsync(utils.node, 0x1, "foo", {from: accounts[0]})
				.then(txid => resolver.setABIAsync(utils.node, 0x1, "", {from: accounts[0]}))
				.then(txid => resolver.ABIAsync(utils.node, 0x1))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [0, "0x"]));
		});

		it('rejects invalid content types', function() {
			return resolver.setABIAsync(utils.node, 0x3, "foo", {from: accounts[0]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids setting value by non-owners', function() {
			return resolver.setABIAsync(utils.node, 0x1, "foo", {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});
	});

	describe('setText function', function() {
	    var url = "https://ethereum.org";
	    var url2 = "https://github.com/ethereum";

		it('permits setting text by owner', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]});
		});

		it('can overwrite previously set text', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url2, {from: accounts[0]}));
		});

		it('can overwrite to same text', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]}));
		});

		it('forbids setting new text by non-owners', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same text by non-owners', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing text by non-owners', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('text function', function() {
	    var url = "https://ethereum.org";
	    var email = "test@ethereum.org";

		it('returns empty string when fetching nonexistent addresses', function() {
			this.slow(200);
			return resolver.textAsync(utils.node, "url")
				.then(result => assert.equal(result, ""));
		});

		it('returns previously set text', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url));
		});

		it('returns different text values for different keys', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url))

				// Set e-mail
				.then(txid => resolver.setTextAsync(utils.node, "email", email, {from: accounts[0]}))
				.then(txid => resolver.textAsync(utils.node, "email"))
				.then(result => assert.equal(result, email))

				// Check url is still unchanged
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url));
		});

		it('returns overwritten text', function() {
			this.slow(300);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]}))
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url));
		});

	});

});
