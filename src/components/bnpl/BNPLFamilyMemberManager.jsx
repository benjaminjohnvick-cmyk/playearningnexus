import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Mail, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function BNPLFamilyMemberManager({ monthlyPayment, onRequirementsMet }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const { data: requirement = {} } = useQuery({
    queryKey: ['bnplRequirement', monthlyPayment],
    queryFn: () => base44.functions.invoke('calculateBNPLFamilyRequirement', {
      monthly_amount: monthlyPayment,
    }).then(r => r.data),
    enabled: !!monthlyPayment,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['familyMembers'],
    queryFn: () => base44.asServiceRole.entities.BNPLFamilyMember.list(),
  });

  const addMemberMutation = useMutation({
    mutationFn: (memberData) =>
      base44.entities.BNPLFamilyMember.create(memberData),
    onSuccess: () => {
      queryClient.invalidateQueries(['familyMembers']);
      queryClient.invalidateQueries(['bnplRequirement']);
      setEmail('');
      setName('');
      toast.success('Family member added!');

      // Check if requirement is met
      if (requirement.can_activate_bnpl || requirement.deficit <= 1) {
        onRequirementsMet?.();
      }
    },
    onError: () => {
      toast.error('Failed to add family member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) =>
      base44.entities.BNPLFamilyMember.delete(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['familyMembers']);
      queryClient.invalidateQueries(['bnplRequirement']);
      toast.success('Family member removed');
    },
  });

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!email || !name) {
      toast.error('Please fill in all fields');
      return;
    }

    addMemberMutation.mutate({
      member_name: name,
      member_email: email,
      status: 'pending',
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Family & Friends Account
          </CardTitle>
          <CardDescription>
            Add people to share BNPL payments. Each person needs to earn ~$120/month to help cover your bills.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Requirement Status */}
          <div className={`p-4 rounded-lg border-2 ${
            requirement.can_activate_bnpl
              ? 'bg-green-50 border-green-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">BNPL Activation Status</h4>
              {requirement.can_activate_bnpl && (
                <Badge className="bg-green-500">Ready to Activate</Badge>
              )}
            </div>
            <p className="text-sm mb-2">
              Monthly Payment: <strong>${requirement.monthly_payment?.toFixed(2)}</strong>
            </p>
            <p className="text-sm">
              Family Members: <strong>{requirement.current_family_members || 0}</strong> /
              <strong> {requirement.users_needed_to_cover || 0}</strong> needed
            </p>
            {requirement.deficit > 0 && (
              <p className="text-sm text-blue-700 mt-1 font-medium">
                Add {requirement.deficit} more member{requirement.deficit > 1 ? 's' : ''} to activate BNPL
              </p>
            )}
          </div>

          {/* Add Member Form */}
          <form onSubmit={handleAddMember} className="space-y-3">
            <input
              type="text"
              placeholder="Name (e.g., Jane Doe)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            />
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={addMemberMutation.isPending}
            >
              <Plus className="w-4 h-4" />
              Add Family Member
            </Button>
          </form>

          {/* Family Members List */}
          {members.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Your Family</h4>
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{member.member_name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {member.member_email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.status === 'active' && (
                      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </Badge>
                    )}
                    <button
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}