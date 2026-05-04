export type TelegramUser = {
  id: number;
  username?: string;
};

export type TelegramChat = {
  id: number;
  title?: string;
  username?: string;
};

export type TelegramForwardOrigin = {
  type: string;
  sender_user?: TelegramUser;
  sender_user_name?: string;
  chat?: TelegramChat;
  message_id?: number;
};

export type TelegramVoice = {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
  forward_origin?: TelegramForwardOrigin;
  forward_from?: TelegramUser;
  forward_sender_name?: string;
  forward_from_chat?: TelegramChat;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};
