import { db } from "@/lib/db";

export interface ZoomMeeting {
  id: string;
  join_url: string;
  start_url: string;
  topic: string;
}

export class ZoomService {
  private static readonly BASE_URL = 'https://api.zoom.us/v2';

  // Get Zoom access token using JWT or OAuth
  private static async getAccessToken(): Promise<string> {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Missing Zoom credentials. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in environment variables.');
    }

    try {
      const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get Zoom token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting Zoom access token:', error);
      throw error;
    }
  }

  // Create a Zoom meeting
  static async createMeeting(topic: string, contactPhone?: string): Promise<ZoomMeeting> {
    try {
      const accessToken = await this.getAccessToken();
      const userId = process.env.ZOOM_USER_ID || 'me'; // Use 'me' for the authenticated user

      const meetingData = {
        topic: topic,
        type: 1, // Instant meeting
        duration: 60, // Default 60 minutes
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: false,
          audio: 'both',
          auto_recording: 'none'
        }
      };

      const response = await fetch(`${this.BASE_URL}/users/${userId}/meetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create Zoom meeting: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const meeting = await response.json();

      // Store meeting in database
      await db.sql`
        INSERT INTO zoom_meetings (
          meeting_id, join_url, start_url, topic, created_for_contact, expires_at
        ) VALUES (
          ${meeting.id.toString()},
          ${meeting.join_url},
          ${meeting.start_url},
          ${topic},
          ${contactPhone || null},
          ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()} -- Expires in 24 hours
        )
      `;

      return {
        id: meeting.id.toString(),
        join_url: meeting.join_url,
        start_url: meeting.start_url,
        topic: topic
      };

    } catch (error) {
      console.error('Error creating Zoom meeting:', error);
      throw error;
    }
  }

  // Get meeting details
  static async getMeeting(meetingId: string): Promise<ZoomMeeting | null> {
    try {
      const { rows } = await db.sql`
        SELECT * FROM zoom_meetings
        WHERE meeting_id = ${meetingId}
        AND expires_at > NOW()
        LIMIT 1
      `;

      if (rows.length === 0) return null;

      const meeting = rows[0];
      return {
        id: meeting.meeting_id,
        join_url: meeting.join_url,
        start_url: meeting.start_url,
        topic: meeting.topic
      };

    } catch (error) {
      console.error('Error getting meeting:', error);
      return null;
    }
  }

  // Delete a meeting
  static async deleteMeeting(meetingId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.BASE_URL}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      // Remove from database
      await db.sql`
        DELETE FROM zoom_meetings WHERE meeting_id = ${meetingId}
      `;

      return response.ok;

    } catch (error) {
      console.error('Error deleting meeting:', error);
      return false;
    }
  }

  // Clean up expired meetings
  static async cleanupExpiredMeetings(): Promise<void> {
    try {
      await db.sql`
        DELETE FROM zoom_meetings WHERE expires_at < NOW()
      `;
    } catch (error) {
      console.error('Error cleaning up expired meetings:', error);
    }
  }
}