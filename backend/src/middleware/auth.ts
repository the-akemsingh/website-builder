import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { config } from "../config";

async function authentication(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            res.status(401).send({
                message: "Unauthorized"
            });
            return;
        }

        const parsedToken = jwt.verify(token, config.get("jwtSecret")) as JwtPayload;
        const { userId, name, email } = parsedToken;
        req.userId = userId
        req.name = name
        req.email = email
        next();
    } catch (e) {
        console.log("Error in authenticating the user", e)
        res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
        return
    }
}

export default authentication