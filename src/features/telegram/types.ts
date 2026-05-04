export type TelegramUser = {
  id: number;
  username?: string;
};

export type TelegramChat = {
  id: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};
