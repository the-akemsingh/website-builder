import { Router } from "express";
import RandomIdGenerator from "../utils/randomIdGenerator";
import { getProjectNameAndTemplate } from "../ai/client";
import { SandboxContainerManager } from "../sandbox/sandboxContainerManager";
import getProjectPort from "../utils/getProjectPort";
import createFileStructure from "../sandbox/createFileStructureInContainer";
import { node } from "../templates/nodejs/template";
import { next } from "../templates/nextjs/template";
import { config } from "../config";
import dbClient from "../prisma/db";
import authentication from "../middleware/auth";

const chatRouter = Router();
const PROJECTS_BASE_URL = config.get("projectsBaseUrl");

// Apply authentication middleware to all routes
chatRouter.use(authentication);

chatRouter.get("/", async (req, res) => {
    try {
        const allProjects = await dbClient.Website.select('id', 'title', 'createdAt', 'templateName').where({
            userId: req.userId
        }).orderBy((website) => website.createdAt.desc()).all()
        res.status(200).send(allProjects)
    } catch (e) {
        console.log("error occured while fetching projects ", e)
        res.sendStatus(500);
        return;
    }
})

chatRouter.delete("/:websiteId", async (req, res) => {
    try {
        const { websiteId } = req.params;
        await SandboxContainerManager.getInstance().deletContainer(websiteId)
        await dbClient.Website.where({
            id: websiteId
        }).delete()
        res.sendStatus(200)
        return;
    } catch (e) {
        console.log("error occured deleting the project ", e)
        res.sendStatus(500);
        return;
    }
})

chatRouter.get("/:websiteId", async (req, res) => {
    try {
        const { websiteId } = req.params;

        const website = await dbClient.Website.select("id", "title", "createdAt", "templateName")
            .where({ id: websiteId })
            .include("Messages", (messages) => messages.orderBy((message) => message.createdAt.asc()))
            .first()

        if (!website) {
            res.sendStatus(404)
            return;
        }

        const websiteUrl = await SandboxContainerManager.getInstance().getContainerUrl(websiteId, website.templateName)

        res.status(200).send({ project: website, url: websiteUrl })
        return
    }
    catch (e) {
        console.log("error occured while fetching chat ", e)
        res.sendStatus(500);
        return;
    }
})
chatRouter.post("/", async (req, res) => {
    try {
        let { prompt } = req.body;
        if (!prompt) {
            res.sendStatus(400)
            return
        }

        const { templateName, title } = await getProjectNameAndTemplate(prompt);
        // const template = templateName === "node" ? node : next

        const newProject = await dbClient.Website.create({
            id: RandomIdGenerator(),
            userId: req.userId!,
            templateName,
            title
        })
        console.log("new chat req rec, prompt : ", prompt)
        // const chatHistoryManager = ChatHistory.getInstance()
        const websiteId = newProject.id;
        console.log("templateName : ", templateName)

        // chatHistoryManager.createChat(websiteId, templateName as 'node' | "next")

        const containerManager = SandboxContainerManager.getInstance();
        const port = getProjectPort(templateName)
        const { hostPort } = await containerManager.createContainer(websiteId, port, templateName)
        console.log("container created")

        // await createFileStructure(projectContainer, template)
        // console.log("file structrue created")

        // console.log("installing dependecies")
        // await containerManager.installDependencies(websiteId)
        // console.log("dependecies installed")

        // console.log("starting server ")
        // await containerManager.startDevServer(websiteId)
        // console.log("server started")

        // setTimeout(() => {
        //     containerManager.stopDevServer(websiteId);
        // }, 30 * 60 * 1000);

        res.send({ websiteId, projectUrl: `${PROJECTS_BASE_URL}:${hostPort}` })
        return;

    } catch (e) {
        console.log("error in chat endpoint", e)
        res.sendStatus(500);
        return;
    }
})

chatRouter.get("/:websiteId/source", async (req, res) => {
    try {
        const { websiteId } = req.params;

        const website = await dbClient.Website.where({
            id: websiteId,
            userId: req.userId,
        }).first();

        if (!website) {
            res.sendStatus(404);
            return;
        }

        const archive = await SandboxContainerManager.getInstance().getSourceArchive(websiteId);

        res.setHeader("Content-Type", "application/x-tar");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${website.title.replace(/[^a-z0-9-_]+/gi, "-")}.tar"`,
        );

        archive.on("error", (error) => {
            console.error("Archive stream error:", error);

            if (!res.headersSent) {
                res.sendStatus(500);
            } else {
                res.destroy(error);
            }
        });

        archive.pipe(res);
    } catch (error) {
        console.error("Error downloading source code:", error);
        if (!res.headersSent) {
            res.sendStatus(500);
        } else {
            res.destroy();
        }
    }
});

export default chatRouter;