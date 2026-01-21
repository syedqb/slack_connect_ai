
export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_private: boolean;
  num_members?: number;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    image_72: string;
  };
}

export interface SlackMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: any;
  error?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface AppState {
  token: string;
  channels: SlackChannel[];
  selectedChannelId: string | null;
  status: AppStatus;
  errorMessage: string | null;
}
