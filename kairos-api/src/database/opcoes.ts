import 'dotenv/config'
import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';
import { User } from '../user/user.entity';
import { Character } from '../character/character.entity';
import { GameMap } from '../map/game-map.entity';
import { Feedback } from '../feedback/feedback.entity';
import { Server } from '../server/server.entity';
import { ServerInvite } from '../server/server-invite.entity';
import { ServerMembership } from '../server/server-membership.entity';
import { Track } from '../jukebox/track.entity';
import { Task } from '../task/task.entity';
import { Note } from '../note/note.entity';
import { Friendship } from '../friend/friendship.entity';
import { FriendServerInvite } from '../friend/friend-server-invite.entity';
import { DmConversation } from '../dm/dm-conversation.entity';
import { DmMessage } from '../dm/dm-message.entity';

export const opcoesDoBanco: DataSourceOptions = {
  type: 'postgres',
  url:
    process.env.DATABASE_URL ||
    'postgres://kairos:kairos@localhost:5432/kairosio',
  entities: [
    User,
    Character,
    GameMap,
    Feedback,
    Server,
    ServerInvite,
    ServerMembership,
    Track,
    Task,
    Note,
    Friendship,
    FriendServerInvite,
    DmConversation,
    DmMessage,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
};
