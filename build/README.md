# ENS.lll build scripts
This directory contains a dockerfile that allows you to reproduce the binary of ENS.lll.bin to verify it corresponds to the source code.

To use it, first examine the Dockerfile to verify it's doing what you think it is. Then, from the main directory run:

    docker build --tag=lllc build
    docker run -v $PWD:/ens lllc:latest -x /ens/ENS.lll > ENS.lll.bin
    git diff

If the last command shows no differences, you can be sure that the bin file represents the accurate output of the specified version of lllc.
