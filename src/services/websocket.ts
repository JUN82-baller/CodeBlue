import { WsClientMessage, WsGroup, WsServerMessage } from '../types';

type MessageCallback = (msg: WsServerMessage) => void;
type StatusCallback = (connected: boolean) => void;

class RealtimeHub {
  private ws: WebSocket | null = null;
  private messageListeners = new Set<MessageCallback>();
  private statusListeners = new Set<StatusCallback>();
  private currentGroup: WsGroup = 'Global';
  private currentDoctorId?: string;
  private currentDoctorName?: string;
  private reconnectTimer: number | null = null;
  private isExplicitDisconnect = false;
  public isConnected = false;

  public connect(group: WsGroup = 'Global', doctorId?: string, doctorName?: string) {
    this.currentGroup = group;
    this.currentDoctorId = doctorId;
    this.currentDoctorName = doctorName;
    this.isExplicitDisconnect = false;

    if (this.ws) {
      this.ws.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        this.send({
          type: 'JOIN_GROUP',
          group: this.currentGroup,
          doctorId: this.currentDoctorId,
          doctorName: this.currentDoctorName,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WsServerMessage = JSON.parse(event.data);
          this.notifyMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        if (!this.isExplicitDisconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket encountered error:', err);
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch (e) {
      console.error('WebSocket connection setup failed:', e);
      this.scheduleReconnect();
    }
  }

  public setGroup(group: WsGroup, doctorId?: string, doctorName?: string) {
    this.currentGroup = group;
    this.currentDoctorId = doctorId;
    this.currentDoctorName = doctorName;

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'JOIN_GROUP',
        group,
        doctorId,
        doctorName,
      });
    } else {
      this.connect(group, doctorId, doctorName);
    }
  }

  public send(msg: WsClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public onMessage(cb: MessageCallback): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  public onStatusChange(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.isConnected);
    return () => this.statusListeners.delete(cb);
  }

  private notifyMessage(msg: WsServerMessage) {
    this.messageListeners.forEach((cb) => {
      try {
        cb(msg);
      } catch (e) {
        console.error('Error in message callback:', e);
      }
    });
  }

  private notifyStatus(status: boolean) {
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (e) {
        console.error('Error in status callback:', e);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      console.log('Reconnecting WebSocket...');
      this.connect(this.currentGroup, this.currentDoctorId, this.currentDoctorName);
    }, 2000);
  }

  public disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.notifyStatus(false);
  }
}

export const realtimeHub = new RealtimeHub();
