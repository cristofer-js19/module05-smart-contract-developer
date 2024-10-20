import { ethers, ignition } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployNFtCollectionFixture() {
    const [owner, ana, john, carl, paul, mary, peter, ...accounts] = await ethers.getSigners()
    const uri = 'https://example.com/image/'
    const name = "NFT Collection"
    const symbol = "NFTC"
    const buyerList = [ana.address, john.address, carl.address, paul.address, mary.address, peter.address]
    const NFtCollection = await ethers.getContractFactory('NFtCollection');

    const nftCollection = await NFtCollection.deploy(uri, buyerList);
    await nftCollection.waitForDeployment()

    return {
        nftCollection,
        name,
        symbol,
        owner,
        ana,
        john,
        carl,
        paul,
        mary,
        peter,
        ...accounts
    }
}

async function deployMaliciousContractFixture() {
    const [deployer, maliciousActor] = await ethers.getSigners();
    const { nftCollection } = await loadFixture(deployNFtCollectionFixture);
    
    const MaliciousContract = await ethers.getContractFactory('MaliciousContract');
    const maliciousContract = await MaliciousContract.connect(maliciousActor).deploy(nftCollection.getAddress());
    await maliciousContract.waitForDeployment();

    return {
        maliciousContract,
        deployer,
        maliciousActor
    }
}

describe("Contrato NFtCollection", () => {
    describe("Implantação", function () {
        it("Deve definir o nome e símbolo corretos", async function () {
            const { nftCollection } = await loadFixture(deployNFtCollectionFixture);

            expect(await nftCollection.name()).to.equal("NFT Collection");
            expect(await nftCollection.symbol()).to.equal("NFTC");
        });

        it("Deve definir o limite correto de supply total", async function () {
            const { nftCollection } = await loadFixture(deployNFtCollectionFixture);

            expect(await nftCollection.TOTAL_SUPPLY()).to.equal(10);
        });

        it("Deve definir o preço correto para os NFTs", async function () {
            const { nftCollection } = await loadFixture(deployNFtCollectionFixture);

            expect(await nftCollection.NFT_PRICE()).to.equal(ethers.parseEther("0.05"));
        });
    });

    describe("Mintando NFTs", function () {
        it("Deve mintar NFT quando o preço correto é pago (1)", async function () {
            const { nftCollection, ana } = await loadFixture(deployNFtCollectionFixture);

            const price = ethers.parseEther("0.05");

            await expect(nftCollection.connect(ana).mint({ value: price }))
                .to.emit(nftCollection, "Transfer")
                .withArgs(ethers.ZeroAddress, ana.address, 0);
            const contractBalance = await ethers.provider.getBalance(nftCollection.target);
            expect(contractBalance).to.equal(price)
            console.log(await nftCollection.tokenIds());
        });

        it("Deve mintar NFT quando o preço correto é pago (2)", async function () {
            const { nftCollection, ana } = await loadFixture(deployNFtCollectionFixture);
            const price = ethers.parseEther("0.01");
            await expect(nftCollection.connect(ana).mint({ value: price }))
                .to.revertedWithCustomError(nftCollection, "NotEnoughPrice")
                .withArgs(price);
        });

        it("Deve reverter se o limite de supply for excedido", async function () {
            const { nftCollection, ana, john, carl, paul, mary, peter } = await loadFixture(deployNFtCollectionFixture);
            const price = ethers.parseEther("0.05");
            for (let i = 0; i < 2; i++) {
                await nftCollection.connect(ana).mint({ value: price });
                await nftCollection.connect(john).mint({ value: price });
                await nftCollection.connect(carl).mint({ value: price });
                await nftCollection.connect(paul).mint({ value: price });
                await nftCollection.connect(mary).mint({ value: price });
            }

            await expect(nftCollection.connect(peter).mint({ value: price }))
            .to.revertedWithCustomError(nftCollection, "MaximumTotalSupplyReached");
        });

        it("Deve reverter se um endereço tentar mintar mais de 2 NFTs", async function () {
            const { nftCollection, ana } = await loadFixture(deployNFtCollectionFixture);
            const price = ethers.parseEther("0.05");
            for (let i = 0; i < 2; i++) {
                await nftCollection.connect(ana).mint({ value: price});
            }

            await expect(nftCollection.connect(ana).mint({ value: price}))
            .to.revertedWithCustomError(nftCollection, "MaxNftsPerAddressReached");
        });

        it("Deve devolver o excesso de ether enviado", async function () {
            const { nftCollection, john } = await loadFixture(deployNFtCollectionFixture);
            const price = ethers.parseEther("0.05");
            const overpaidValue = ethers.parseEther("0.1");
            const initialBalance = await ethers.provider.getBalance(john.address);

            const transaction = await nftCollection.connect(john).mint({ value: overpaidValue });
            const receipt = await transaction.wait();
            
            const gasUsed = receipt!.gasUsed * BigInt(receipt!.gasPrice);

            const finalBalance = await ethers.provider.getBalance(john.address);
            const totalSpent = initialBalance - finalBalance;
            expect(totalSpent).to.equal(price + gasUsed);
        });
    });

    describe("Segurança e Validação", function () {
        it("Deve permitir apenas ao proprietário sacar o saldo", async function () {
            const { nftCollection, owner, ana } = await loadFixture(deployNFtCollectionFixture);
            await expect(nftCollection.connect(ana).withdraw()).to.be.revertedWithCustomError(nftCollection, "OwnableUnauthorizedAccount")

            await nftCollection.connect(owner).withdraw();
            expect(await ethers.provider.getBalance(nftCollection.target)).to.equal(0);
        });

        it("Deve prevenir ataque de reentrância no saque", async function () {
            const { maliciousContract, deployer, maliciousActor } = await loadFixture(deployMaliciousContractFixture);
            const { nftCollection, owner } = await loadFixture(deployNFtCollectionFixture);
            
            await owner.sendTransaction({
                to: nftCollection.getAddress(),
                value: ethers.parseEther("1")
            });

            await expect(maliciousContract.connect(maliciousActor).attack({
                value: ethers.parseEther("0.1")
            })).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });
    });
})