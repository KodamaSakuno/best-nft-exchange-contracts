import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";
import { utils, BigNumber } from "ethers";

import {
    ERC20Mock, ERC20Mock__factory,
    BestNftExchange, BestNftExchange__factory,
    ERC1155Mock, ERC1155Mock__factory,
} from "../typechain";

describe("BestNftExchange", () => {
    let wallet: SignerWithAddress;
    let owner: SignerWithAddress;
    let trader1: SignerWithAddress;
    let trader2: SignerWithAddress;

    let token: ERC20Mock;
    let exchange: BestNftExchange;
    let nft: ERC1155Mock;

    async function getOrders() {
        let orders: any = await exchange.getOrders();

        return orders.map(({ nft, id, amount, owner, price }) => ({ nft, id, amount, owner, price }));
    }
    async function getOrder(orderId: number) {
        const { nft, id, amount, owner, price } = <any>await exchange.getOrder(orderId);

        return { nft, id, amount, owner, price };
    }

    beforeAll(async () => {
        [wallet, owner, trader1, trader2] = await ethers.getSigners();

        token = await new ERC20Mock__factory(owner).deploy("Best Token", "BEST");
        exchange = await new BestNftExchange__factory(owner).deploy(token.address);
        nft = await new ERC1155Mock__factory(owner).deploy("http://best/{id}.json");
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

        await expect(token.balanceOf(wallet.address)).resolves.toEqual(fee);
    });

    test("Add single order by direct transfer", async () => {
        await nft.mint(wallet.address, 1, 1, "0x");
        await nft.mint(wallet.address, 2, 2, "0x");
        await nft.mint(wallet.address, 3, 3, "0x");
        await nft.mint(wallet.address, 4, 5, "0x");

        await nft.connect(wallet).safeTransferFrom(wallet.address, exchange.address, 1, 1, "0x");
        await nft.connect(wallet).safeTransferFrom(wallet.address, exchange.address, 2, 2, "0x");
        await nft.connect(wallet).safeTransferFrom(wallet.address, exchange.address, 3, 3, "0x");

        await nft.connect(wallet).safeTransferFrom(wallet.address, exchange.address, 4, 2, utils.defaultAbiCoder.encode(["uint256"], [utils.parseEther("8")]));
        await nft.connect(wallet).safeTransferFrom(wallet.address, exchange.address, 4, 3, utils.defaultAbiCoder.encode(["uint256"], [utils.parseEther("9")]));

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(5));

        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(1),
                amount: BigNumber.from(1),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(2),
                amount: BigNumber.from(2),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(3),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: BigNumber.from(0),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(2),
                owner: wallet.address,
                price: utils.parseEther("8"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
        ]);
    });

    test("Set price", async () => {
        await exchange.connect(wallet).setPrice(3, utils.parseEther("7"));

        await expect(getOrder(3)).resolves.toEqual({
            nft: nft.address,
            id: BigNumber.from(3),
            amount: BigNumber.from(3),
            owner: wallet.address,
            price: utils.parseEther("7"),
        });
    });

    test("Revoke order", async () => {
        await exchange.connect(wallet).revoke(2);
        await exchange.connect(wallet).revoke(1);

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(3));
        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(3),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("7"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(2),
                owner: wallet.address,
                price: utils.parseEther("8"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
        ]);

        await expect(nft.balanceOf(wallet.address, 2)).resolves.toEqual(BigNumber.from(2));
    });

    test("Failed to operate with absent id", async () => {
        await expect(exchange.connect(wallet).setPrice(2, utils.parseEther("222"))).rejects.toThrowError("BestNftExchange: bad id");
        await expect(exchange.connect(wallet).buy(2)).rejects.toThrowError("BestNftExchange: bad id");
        await expect(exchange.connect(wallet).revoke(2)).rejects.toThrowError("BestNftExchange: bad id");
        await expect(exchange.connect(trader1).setPrice(2, utils.parseEther("222"))).rejects.toThrowError("BestNftExchange: bad id");
        await expect(exchange.connect(trader1).buy(2)).rejects.toThrowError("BestNftExchange: bad id");
        await expect(exchange.connect(trader1).revoke(2)).rejects.toThrowError("BestNftExchange: bad id");
    });

    test("Add multiple orders by direct transfer", async () => {
        await nft.mint(wallet.address, 5, 5, "0x");
        await nft.mint(wallet.address, 6, 6, "0x");
        await nft.mint(wallet.address, 7, 7, "0x");

        const prices = utils.defaultAbiCoder.encode(["uint256[]"], [[utils.parseEther("1"), utils.parseEther("2"), utils.parseEther("3"), utils.parseEther("4")]]);
        await nft.connect(wallet).safeBatchTransferFrom(wallet.address, exchange.address, [5, 6, 7, 7], [5, 6, 3, 4], prices);

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(7));

        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(3),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("7"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(2),
                owner: wallet.address,
                price: utils.parseEther("8"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(5),
                amount: BigNumber.from(5),
                owner: wallet.address,
                price: utils.parseEther("1"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(6),
                amount: BigNumber.from(6),
                owner: wallet.address,
                price: utils.parseEther("2"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(7),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("3"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(7),
                amount: BigNumber.from(4),
                owner: wallet.address,
                price: utils.parseEther("4"),
            },
        ]);
    });

    test("Failed to trade because of insufficient balance", () => {
        expect(exchange.connect(trader2).buy(3)).rejects.toThrowError("VM Exception while processing transaction: revert BestNftExchange: insufficient balance");
    });

    test("Successful trade", async () => {
        const balance = utils.parseEther("3");
        await token.mint(trader1.address, balance);
        await token.connect(trader1).approve(exchange.address, balance);

        await expect(exchange.connect(trader1).buy(8)).resolves.not.toThrow();

        await expect(exchange.totalOrder()).resolves.toEqual(BigNumber.from(6));
        await expect(getOrders()).resolves.toEqual([
            {
                nft: nft.address,
                id: BigNumber.from(3),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("7"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(2),
                owner: wallet.address,
                price: utils.parseEther("8"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(4),
                amount: BigNumber.from(3),
                owner: wallet.address,
                price: utils.parseEther("9"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(5),
                amount: BigNumber.from(5),
                owner: wallet.address,
                price: utils.parseEther("1"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(6),
                amount: BigNumber.from(6),
                owner: wallet.address,
                price: utils.parseEther("2"),
            },
            {
                nft: nft.address,
                id: BigNumber.from(7),
                amount: BigNumber.from(4),
                owner: wallet.address,
                price: utils.parseEther("4"),
            },
        ]);

        await expect(nft.balanceOf(trader1.address, 7)).resolves.toEqual(BigNumber.from(3));
        await expect(token.balanceOf(wallet.address)).resolves.toEqual(utils.parseEther("126"));
    });

    test("Failed to buy owner's order", () => {
        expect(exchange.connect(wallet).buy(1)).rejects.toThrowError("VM Exception while processing transaction: revert BestNftExchange: you're the owner of this order");
    });
});
