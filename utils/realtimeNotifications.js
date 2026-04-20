const clientsByUserId = new Map();

const writeSseEvent = (response, payload) => {
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const registerNotificationStream = (userId, response) => {
    if (!clientsByUserId.has(userId)) {
        clientsByUserId.set(userId, new Set());
    }

    const userClients = clientsByUserId.get(userId);
    userClients.add(response);

    writeSseEvent(response, {
        type: 'connected',
        message: 'Notification stream connected',
        at: new Date().toISOString(),
    });

    const keepAliveTimer = setInterval(() => {
        response.write(': keep-alive\n\n');
    }, 25000);

    const cleanup = () => {
        clearInterval(keepAliveTimer);
        userClients.delete(response);
        if (userClients.size === 0) {
            clientsByUserId.delete(userId);
        }
    };

    return cleanup;
};

const publishNotificationToUser = (userId, payload) => {
    const userClients = clientsByUserId.get(userId);
    if (!userClients || userClients.size === 0) return;

    userClients.forEach((response) => {
        writeSseEvent(response, payload);
    });
};

module.exports = {
    registerNotificationStream,
    publishNotificationToUser,
};
