import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";
import { utils, BigNumber } from "ethers";

import {
    ERC20Mock, ERC20Mock__factory,
    BestNftExchange, BestNftExchange__factory,
    ERC721Mock, ERC721Mock__factory,
} from "../typechain";

describe("BestNftExchange", () => {
    let wallet: SignerWithAddress;
    let owner: SignerWithAddress;
    let trader1: SignerWithAddress;
    let trader2: SignerWithAddress;

    let token: ERC20Mock;
    let exchange: BestNftExchange;
    let nft: ERC721Mock;

    async function getOrders() {
        let orders: any = await exchange.getOrders();

        return orders.map(({ nft, id, owner, price }) => ({ nft, id, owner, price }));
    }
    async function getOrder(orderId: number) {
        const { nft, id, owner, price } = <any>await exchange.getOrder(orderId);

        return { nft, id, owner, price };
    }

    beforeAll(async () => {
        [wallet, owner, trader1, trader2] = await ethers.getSigners();

        token = await new ERC20Mock__factory(owner).deploy("Best Token", "BEST");
        exchange = await new BestNftExchange__factory(owner).deploy(token.address);
        nft = await new ERC721Mock__factory(owner).deploy("Best NFT", "BNFT");
    });

    test("Initialized successfully", () => {
        expect(exchange.owner()).resolves.toBe(owner.address);
        expect(exchange.isAdmin(owner.address)).resolves.toBe(true);
        expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(0));
    });
    test("Administrator add & remove", async () => {
        await expect(exchange.isAdmin(wallet.address)).resolves.toBe(false);
        await exchange.addAdmin(wallet.address);
        await expect(exchange.isAdmin(wallet.address)).resolves.toBe(true);
        await exchange.removeAdmin(wallet.address);
        await expect(exchange.isAdmin(wallet.address)).resolves.toBe(false);
    });
    test("Withdraw fee by administrator", async () => {
        const fee = utils.parseEther("123");

        await token.mint(exchange.address, fee);
        await exchange.addAdmin(wallet.address);

        await exchange.connect(wallet).withdrawAll();

        expect(await token.balanceOf(wallet.address)).toEqual(fee);
    });

    test("Add order by direct transfer", async () => {
        await nft.mint(wallet.address, 1);
        await nft.mint(wallet.address, 2);
        await nft.mint(wallet.address, 3);
        await nft.mint(wallet.address, 4);

        await nft.connect(wallet)["safeTransferFrom(address,address,uint256)"](wallet.address, exchange.address, 1);
        await nft.connect(wallet)["safeTransferFrom(address,address,uint256)"](wallet.address, exchange.address, 2);
        await nft.connect(wallet)["safeTransferFrom(address,address,uint256)"](wallet.address, exchange.address, 3);

        const price = utils.defaultAbiCoder.encode([utils.ParamType.fromString("uint256")], ["9000000000000000000"]);
        await nft.connect(wallet)["safeTransferFrom(address,address,uint256,bytes)"](wallet.address, exchange.address, 4, price);

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(4));

        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(1),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(2),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(3),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
        ]);
    });

    test("Set price", async () => {
        await exchange.connect(wallet).set_price(2, utils.parseEther("7"));

        await expect(getOrder(2)).resolves.toEqual({
            nft: nft.address,
            id: BigNumber.from(3),
            owner: wallet.address,
            price: utils.parseEther("7"),
        });
    });

    test("Revoke order", async () => {
        await exchange.connect(wallet).revoke(1);

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(3));
        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(1),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("7"),
            },
        ]);

        await expect(nft.ownerOf(2)).resolves.toBe(wallet.address);
    });

    test("Failed to trade because of insufficient balance", async () => {
        await expect(exchange.connect(trader2).buy(2)).rejects.toThrowError("VM Exception while processing transaction: revert BestNftExchange: insufficient balance");

        const balance = utils.parseEther("7");
        await token.mint(trader1.address, balance);
        await token.connect(trader1).approve(exchange.address, balance);

        await expect(exchange.connect(trader1).buy(2)).resolves.not.toThrow();

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(2));
        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(1),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
        ]);

        await expect(nft.ownerOf(3)).resolves.toBe(trader1.address);
        await expect(token.balanceOf(wallet.address)).resolves.toEqual(utils.parseEther("130"));
    });
});
