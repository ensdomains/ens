FROM ubuntu:latest
RUN (apt-get update \
     && apt-get -y install git lsb-release sudo software-properties-common)
RUN (git clone --recursive https://github.com/ethereum/solidity.git \
     && cd solidity \
     && git checkout 4633f3de \
     && git submodule update --init --recursive)
RUN (cd solidity \
     && ./scripts/install_deps.sh)
RUN (cd solidity \
     && mkdir build \
     && cd build \
     && cmake .. \
     && make lllc \
     && cp lllc/lllc /usr/local/bin)
ENTRYPOINT ["/usr/local/bin/lllc"]
