var assert = require('assert');
var async = require('async');
var fs = require('fs');
var Promise = require('bluebird');
var solc = require('solc');
var Web3 = require('web3');
var namehash = require('eth-ens-namehash');

var TestRPC = require('ethereumjs-testrpc');
var web3 = new Web3();
web3.setProvider(TestRPC.provider());


var ensCode = null;
var ensLLLCode = null;

function compileContract(filenames, sourceRoot) {
	if (!sourceRoot) {
		sourceRoot = './contracts/';
	}

	var sources = {};

	filenames.forEach((filename) => {
		sources[filename] = fs.readFileSync(sourceRoot + filename).toString();
	});

	var compiled = solc.compile({sources: sources}, 1);
	assert.equal(compiled.errors, undefined, compiled.errors);
	return compiled;
}

module.exports = {
	node: namehash('eth'),
	compileContract: compileContract,
	deployENS: function (account, done) {
		if (ensCode == null)
			ensCode = compileContract(['ENS.sol', 'AbstractENS.sol']).contracts['ENS.sol:ENS'];
		var ens = web3.eth.contract(JSON.parse(ensCode.interface)).new(
		    {
		    	from: account,
		     	data: ensCode.bytecode,
		     	gas: 4700000
		   	}, function(err, contract) {
		   	    assert.equal(err, null, err);
		   	    if (contract.address != undefined) {
		   	    	ens = Promise.promisifyAll(ens);
		   	    	done(null, ens);
			   	}
		   });
		return ens;
	},
	deployENSLLL: function(account, done) {
		if (ensLLLCode == null) {
			var lllArtifactPath = './build/contracts/ENS.lll.json';
			var ensLLLArtifact = JSON.parse(fs.readFileSync(lllArtifactPath).toString());

			ensLLLCode = {
				bytecode: ensLLLArtifact.unlinked_binary,
				interface: ensLLLArtifact.abi
			}
		}

		return web3.eth.contract(ensLLLCode.interface)
			.new(
				{
					from: account,
					data: ensLLLCode.bytecode,
					gas: 4700000
				},
				function(err, contract) {
					assert.equal(err, null, err);
					if (contract.address != undefined) {
						done();
					}
				});
	},
	web3: web3,
	promisifyContractFactory: function(contractFactory) {
		contractFactory.newAsync = function() {
			var args = arguments;
			return new Promise(function(resolve, reject) {
				args[args.length] = function(err, contract) {
					if (err) {
						reject(err);
					} else if (typeof contract.address !== "undefined") {
						resolve(contract);
					} else {
						// There is to hope that reject or resolve is called
					}
				};
				args.length++;
				contractFactory.new.apply(contractFactory, args);
			});
		};
		return contractFactory;
	}
};
