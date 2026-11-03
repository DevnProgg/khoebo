import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { MemberRole } from '../lib/types';
import { useAuth } from '../providers/AuthProvider';

export function useBusinessRole() {
  const { business, user } = useAuth();
  const isOwner = Boolean(business && user && business.owner_id === user.id);

  const members = useQuery({
    queryKey: ['members', business?.id],
    queryFn: () => api.businesses.members(business!.id),
    enabled: Boolean(business && !isOwner),
  });

  const role: MemberRole | null = isOwner
    ? 'owner'
    : members.data?.find((member) => member.user_id === user?.id)?.role ?? null;

  return {
    role,
    isOwner,
    canManage: role === 'owner' || role === 'admin',
    loading: !isOwner && members.isLoading,
    members,
  };
}
