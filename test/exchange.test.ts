import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";
import { utils } from "ethers";

import {
    ERC20Mock, ERC20Mock__factory,
    BestNftExchange, BestNftExchange__factory,
    ERC721Mock, ERC721Mock__factory,
} from "../typechain";

describe("BestNftExchange", () => {
    let wallet: SignerWithAddress;
    let owner: SignerWithAddress;

    let token: ERC20Mock;
    let exchange: BestNftExchange;
    let nft: ERC721Mock;

    beforeEach(async () => {
        [wallet, owner] = await ethers.getSigners();

        token = await new ERC20Mock__factory(owner).deploy("Best Token", "BEST");
        exchange = await new BestNftExchange__factory(owner).deploy(token.address);
        nft = await new ERC721Mock__factory(owner).deploy("Best NFT", "BNFT");
    });

    test("Initialized successfully", () => {
        expect(exchange.owner()).resolves.toBe(owner.address);
        expect(exchange.isAdmin(owner.address)).resolves.toBe(true);
        expect(exchange.totalOrder()).resolves.toEqual(utils.parseEther("0"));
    });
    test("Administrator add & remove", async () => {
        expect(await exchange.isAdmin(wallet.address)).toBe(false);
        await exchange.addAdmin(wallet.address);
        expect(await exchange.isAdmin(wallet.address)).toBe(true);
        await exchange.removeAdmin(wallet.address);
        expect(await exchange.isAdmin(wallet.address)).toBe(false);
    });
    test("Withdraw fee by administrator", async () => {
        const fee = utils.parseUnits("123", 18);

        await token.mint(exchange.address, fee);
        await exchange.addAdmin(wallet.address);

        await exchange.connect(wallet).withdrawAll();

        expect(await token.balanceOf(wallet.address)).toEqual(fee);
    });
});
