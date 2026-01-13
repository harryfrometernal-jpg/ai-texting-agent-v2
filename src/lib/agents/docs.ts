import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";
import * as docsTools from "@/lib/google/docs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const tools = {
    create_sop: {
        description: "Create a new Standard Operating Procedure (SOP) document.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING, description: "Title of the SOP" },
                content: { type: SchemaType.STRING, description: "The full content of the SOP" },
            },
            required: ["title", "content"]
        }
    }
};

export async function runDocsAgent(context: IncomingMessageContext): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        tools: [{ functionDeclarations: Object.entries(tools).map(([name, schema]) => ({ name, ...schema })) as any }]
    });

    const chat = model.startChat({
        history: [
            { role: "user", parts: [{ text: "You are an SOP Assistant. Create documents based on user instructions." }] }
        ]
    });

    try {
        const result = await chat.sendMessage(context.body);
        const call = result.response.functionCalls()?.[0];

        if (call && call.name === 'create_sop') {
            const args = call.args as any;
            const doc = await docsTools.createDoc(args.title);
            if (doc.documentId) {
                await docsTools.appendText(doc.documentId, args.content);
                return `SOP Document created: https://docs.google.com/document/d/${doc.documentId}`;
            }
        }

        return result.response.text();
    } catch (error) {
        console.error("Docs Agent Error:", error);
        return "I couldn't create the document. Please check my permissions.";
    }
}
