import { Router } from "express";
const authRouter = Router();
import jwt from 'jsonwebtoken'
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import dbClient from "../prisma/db";


authRouter.post("/", async (req, res) => {
    try {
        const googleClientId = config.get("googleClientId")
        const client = new OAuth2Client();
        const { token } = req.body;
        if (!token) {
            res.status(400).json({
                message: "Google token is required",
            });
            return;
        }

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: googleClientId,
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            res.status(400).json({
                message: "Invalid Google token",
            });
            return;
        }

        const email = payload.email;
        const name = payload.name as string;
        const googleId = payload.sub;

        let user = await dbClient.User.first({
            email
        });

        if (!user) {
            user = await dbClient.User.create({
                email,
                name,
                googleId,
            });
        }

        const appToken = jwt.sign(
            {
                userId: user.id,
                name: user.name,
                email: user.email,
            },
            config.get("jwtSecret"),
            {
                expiresIn: "7d",
            },
        );
        res.json({
            message: "Login successful",
            token: appToken,
            user: {
                email: user.email,
                id: user.id,
                name: user.name,
                image: payload.picture,
            },
        });
        return;
    } catch (e) {
        console.log("error loggin in user:", e)
        res.sendStatus(500);
        return
    }
})


export default authRouter;