const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { handleChatMessage } = require('../services/chatbot');

router.post('/message', auth, async (req, res) => {
  try {
    const { message, language, history = [], conversationState = null } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const result = await handleChatMessage({
      workerId: req.user.id,
      message: message.trim(),
      language,
      history,
      conversationState,
    });

    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
