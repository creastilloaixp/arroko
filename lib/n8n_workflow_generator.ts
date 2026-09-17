/**
 * N8N Workflow Generator
 * Utility for programmatically creating n8n workflows
 */

export interface N8NNode {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
    credentials?: Record<string, { id: string; name: string }>;
}

export interface N8NConnection {
    node: string;
    type: string;
    index: number;
}

export interface N8NWorkflow {
    name: string;
    nodes: N8NNode[];
    connections: Record<string, Record<string, N8NConnection[][]>>;
    settings?: Record<string, any>;
    staticData?: any;
    tags?: string[];
    versionId?: string;
}

/**
 * Builder class for creating n8n workflows
 */
export class N8NWorkflowBuilder {
    private workflow: N8NWorkflow;
    private nodePositionX = 0;
    private nodePositionY = 0;
    private lastNodeId: string | null = null;

    constructor(name: string) {
        this.workflow = {
            name,
            nodes: [],
            connections: {},
            settings: {
                executionOrder: "v1",
            },
            tags: [],
            versionId: "1.0.0",
        };
    }

    /**
     * Add a webhook trigger node
     */
    addWebhook(
        id: string,
        path: string,
        method: "GET" | "POST" = "POST",
    ): this {
        const node: N8NNode = {
            id,
            name: "Webhook",
            type: "n8n-nodes-base.webhook",
            typeVersion: 2,
            position: [this.nodePositionX, this.nodePositionY],
            parameters: {
                httpMethod: method,
                path,
                responseMode: "lastNode",
                options: {},
            },
        };

        this.workflow.nodes.push(node);
        this.lastNodeId = id;
        this.nodePositionX += 200;
        return this;
    }

    /**
     * Add a Set node for data transformation
     */
    addSet(
        id: string,
        name: string,
        assignments: Array<{ name: string; value: string; type?: string }>,
    ): this {
        const node: N8NNode = {
            id,
            name,
            type: "n8n-nodes-base.set",
            typeVersion: 3.4,
            position: [this.nodePositionX, this.nodePositionY],
            parameters: {
                assignments: {
                    assignments: assignments.map((a, idx) => ({
                        id: `assign_${idx}`,
                        name: a.name,
                        value: a.value,
                        type: a.type || "string",
                    })),
                },
            },
        };

        this.workflow.nodes.push(node);
        if (this.lastNodeId) {
            this.connect(this.lastNodeId, id);
        }
        this.lastNodeId = id;
        this.nodePositionX += 200;
        return this;
    }

    /**
     * Add an HTTP Request node
     */
    addHttpRequest(
        id: string,
        name: string,
        url: string,
        method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
        headers?: Record<string, string>,
        body?: Record<string, any>,
    ): this {
        const headerParams = headers
            ? Object.entries(headers).map(([name, value]) => ({ name, value }))
            : [];

        const bodyParams = body
            ? Object.entries(body).map(([name, value]) => ({ name, value }))
            : [];

        const node: N8NNode = {
            id,
            name,
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.2,
            position: [this.nodePositionX, this.nodePositionY],
            parameters: {
                url,
                method,
                sendHeaders: headerParams.length > 0,
                headerParameters: headerParams.length > 0
                    ? { parameters: headerParams }
                    : undefined,
                sendBody: bodyParams.length > 0,
                bodyParameters: bodyParams.length > 0
                    ? { parameters: bodyParams }
                    : undefined,
                options: {},
            },
        };

        this.workflow.nodes.push(node);
        if (this.lastNodeId) {
            this.connect(this.lastNodeId, id);
        }
        this.lastNodeId = id;
        this.nodePositionX += 200;
        return this;
    }

    /**
     * Add a Code node (JavaScript)
     */
    addCode(id: string, name: string, jsCode: string): this {
        const node: N8NNode = {
            id,
            name,
            type: "n8n-nodes-base.code",
            typeVersion: 2,
            position: [this.nodePositionX, this.nodePositionY],
            parameters: {
                jsCode,
                options: {},
            },
        };

        this.workflow.nodes.push(node);
        if (this.lastNodeId) {
            this.connect(this.lastNodeId, id);
        }
        this.lastNodeId = id;
        this.nodePositionX += 200;
        return this;
    }

    /**
     * Add an OpenAI Chat Model node
     */
    addOpenAIModel(
        id: string,
        model: string = "gpt-4o-mini",
        credentialId: string = "openai_creds",
    ): this {
        const node: N8NNode = {
            id,
            name: "OpenAI Model",
            type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
            typeVersion: 1.2,
            position: [this.nodePositionX, this.nodePositionY - 100],
            parameters: {
                model: {
                    __rl: true,
                    mode: "list",
                    value: model,
                },
                options: {
                    temperature: 0.7,
                },
            },
            credentials: {
                openAiApi: {
                    id: credentialId,
                    name: "OpenAI",
                },
            },
        };

        this.workflow.nodes.push(node);
        return this;
    }

    /**
     * Add a Memory node
     */
    addMemory(
        id: string,
        sessionKey: string = "={{ $json.customer_id }}",
    ): this {
        const node: N8NNode = {
            id,
            name: "Memory",
            type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
            typeVersion: 1.3,
            position: [this.nodePositionX, this.nodePositionY + 100],
            parameters: {
                sessionIdType: "customKey",
                sessionKey,
                contextWindowLength: 10,
            },
        };

        this.workflow.nodes.push(node);
        return this;
    }

    /**
     * Add an AI Agent node
     */
    addAIAgent(
        id: string,
        inputText: string,
        systemMessage: string,
        modelNodeId: string,
        memoryNodeId: string,
    ): this {
        const node: N8NNode = {
            id,
            name: "AI Agent",
            type: "@n8n/n8n-nodes-langchain.chainLlm",
            typeVersion: 1.4,
            position: [this.nodePositionX, this.nodePositionY],
            parameters: {
                text: inputText,
                options: {
                    systemMessage,
                },
            },
        };

        this.workflow.nodes.push(node);

        // Connect model and memory
        this.connectAI(modelNodeId, id, "ai_languageModel");
        this.connectAI(memoryNodeId, id, "ai_memory");

        if (this.lastNodeId) {
            this.connect(this.lastNodeId, id);
        }
        this.lastNodeId = id;
        this.nodePositionX += 200;
        return this;
    }

    /**
     * Connect two nodes
     */
    connect(
        fromNodeId: string,
        toNodeId: string,
        type: string = "main",
        index: number = 0,
    ): this {
        if (!this.workflow.connections[fromNodeId]) {
            this.workflow.connections[fromNodeId] = {};
        }
        if (!this.workflow.connections[fromNodeId][type]) {
            this.workflow.connections[fromNodeId][type] = [];
        }
        if (!this.workflow.connections[fromNodeId][type][index]) {
            this.workflow.connections[fromNodeId][type][index] = [];
        }

        this.workflow.connections[fromNodeId][type][index].push({
            node: toNodeId,
            type,
            index: 0,
        });

        return this;
    }

    /**
     * Connect AI nodes (special connection type)
     */
    connectAI(
        fromNodeId: string,
        toNodeId: string,
        connectionType: string,
    ): this {
        if (!this.workflow.connections[fromNodeId]) {
            this.workflow.connections[fromNodeId] = {};
        }
        if (!this.workflow.connections[fromNodeId][connectionType]) {
            this.workflow.connections[fromNodeId][connectionType] = [];
        }
        if (!this.workflow.connections[fromNodeId][connectionType][0]) {
            this.workflow.connections[fromNodeId][connectionType][0] = [];
        }

        this.workflow.connections[fromNodeId][connectionType][0].push({
            node: toNodeId,
            type: connectionType,
            index: 0,
        });

        return this;
    }

    /**
     * Move to next row (for parallel nodes)
     */
    nextRow(offsetY: number = 200): this {
        this.nodePositionY += offsetY;
        this.nodePositionX = 0;
        return this;
    }

    /**
     * Build and return the workflow
     */
    build(): N8NWorkflow {
        return this.workflow;
    }

    /**
     * Export workflow as JSON string
     */
    toJSON(): string {
        return JSON.stringify(this.workflow, null, 2);
    }
}

/**
 * Example: Create a simple WhatsApp workflow
 */
export function createSimpleWhatsAppWorkflow(): N8NWorkflow {
    const builder = new N8NWorkflowBuilder("Simple WhatsApp Bot");

    builder
        .addWebhook("webhook", "whatsapp", "POST")
        .addSet("extract", "Extract Data", [
            { name: "phone", value: "={{ $json.body.data.key.remoteJid }}" },
            {
                name: "message",
                value: "={{ $json.body.data.message.conversation }}",
            },
        ])
        .addHttpRequest(
            "respond",
            "Send Response",
            "https://api.example.com/send",
            "POST",
            { "Content-Type": "application/json" },
            { phone: "={{ $json.phone }}", message: "Hello!" },
        );

    return builder.build();
}

/**
 * Helper: Create Supabase RPC call node
 */
export function createSupabaseRPCNode(
    id: string,
    name: string,
    functionName: string,
    params: Record<string, string>,
    position: [number, number],
): N8NNode {
    return {
        id,
        name,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position,
        parameters: {
            url: `={{ $env.SUPABASE_URL }}/rest/v1/rpc/${functionName}`,
            method: "POST",
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    { name: "apikey", value: "={{ $env.SUPABASE_ANON_KEY }}" },
                    {
                        name: "Authorization",
                        value: "=Bearer {{ $env.SUPABASE_ANON_KEY }}",
                    },
                    { name: "Content-Type", value: "application/json" },
                ],
            },
            sendBody: true,
            bodyParameters: {
                parameters: Object.entries(params).map(([name, value]) => ({
                    name,
                    value,
                })),
            },
            options: {},
        },
    };
}
