import { Router } from "express";
const authRouter = Router();
import jwt from 'jsonwebtoken'
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import dbClient from "../prisma/db";
import { CreditService } from "../billing/creditService";
import { logError, requestId } from "../logger";


authRouter.post("/", async (req, res) => {
    const id = requestId(res);
    let stage = "initializing";

    try {
        const googleClientId = config.get("googleClientId")
        const client = new OAuth2Client();
        const { token } = req.body;
        if (!token) {
            console.warn(JSON.stringify({
                level: "warn",
                message: "Google sign-in request missing token",
                requestId: id,
            }));
            res.status(400).json({
                message: "Google token is required",
                requestId: id,
            });
            return;
        }

        if (!googleClientId) {
            logError("Google sign-in is not configured", new Error("GOOGLE_CLIENT_ID is missing"), {
                requestId: id,
            });
            res.status(503).json({
                message: "Google sign-in is not configured",
                requestId: id,
            });
            return;
        }

        stage = "verifying-google-token";
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken: token,
                audience: googleClientId,
            });
        } catch (error) {
            logError("Google ID token verification failed", error, {
                requestId: id,
                stage,
                googleClientConfigured: true,
            });
            res.status(401).json({
                message: "Invalid Google token",
                requestId: id,
            });
            return;
        }

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            console.warn(JSON.stringify({
                level: "warn",
                message: "Google token had no email claim",
                requestId: id,
                hasPayload: Boolean(payload),
            }));
            res.status(400).json({
                message: "Invalid Google token",
                requestId: id,
            });
            return;
        }

        const email = payload.email;
        const name = payload.name as string;
        const googleId = payload.sub;

        stage = "loading-user";
        let user = await dbClient.User.first({
            email
        });

        if (!user) {
            stage = "creating-user";
            user = await CreditService.createUserWithSignupBonus({
                email,
                name,
                googleId,
            });
        }

        stage = "creating-session";
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
    } catch (error) {
        logError("Google sign-in failed", error, {
            requestId: id,
            stage,
        });
        res.status(500).json({
            message: "Unable to sign in",
            requestId: id,
        });
        return
    }
})


export default authRouter;
