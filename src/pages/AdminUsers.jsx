import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Edit, Search, DollarSign, Calendar, UserCheck, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function logAudit(actor, actionType, target, details) {
  base44.entities.AdminAuditLog.create({
    actor_email: actor.email,
    actor_id: actor.id,
    action_type: actionType,
    target,
    details,
    timestamp: new Date().toISOString()
  });
}

export default function AdminUsers() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [impersonating, setImpersonating] = useState(() => {
    const s = sessionStorage.getItem('impersonating_user');
    return s ? JSON.parse(s) : null;
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        if (user.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setCurrentUser(user);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('-created_date', 1000),
    enabled: !!currentUser
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }) => {
      return await base44.entities.User.update(userId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['all-users']);
      toast.success('User updated successfully');
      setEditingUser(null);
    }
  });

  const filteredUsers = allUsers.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImpersonate = (user) => {
    const data = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
    sessionStorage.setItem('impersonating_user', JSON.stringify(data));
    setImpersonating(data);
    logAudit(currentUser, 'impersonate_user', user.email, `Admin started impersonating user: ${user.full_name || user.email}`);
    toast.success(`Now impersonating ${user.full_name || user.email}`);
  };

  const exitImpersonation = () => {
    logAudit(currentUser, 'exit_impersonation', impersonating?.email, `Admin exited impersonation of ${impersonating?.full_name || impersonating?.email}`);
    sessionStorage.removeItem('impersonating_user');
    setImpersonating(null);
    toast.success('Exited impersonation mode');
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p>You don't have permission to view this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">⚠️ IMPERSONATION MODE ACTIVE</p>
              <p className="text-xs opacity-90">You are viewing as: <strong>{impersonating.full_name || impersonating.email}</strong> ({impersonating.email}) — Role: {impersonating.role}</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={exitImpersonation} className="bg-white text-orange-700 hover:bg-orange-100 flex-shrink-0">
            <X className="w-4 h-4 mr-1" /> Exit Impersonation
          </Button>
        </div>
      )}
      <div className={`max-w-7xl mx-auto ${impersonating ? 'mt-20' : ''}`}>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-red-600" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600">{allUsers.length} total users</p>
            </div>
          </div>
        </div>

        <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <div className="flex items-center gap-4">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </Card>

        <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-red-50">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || 'N/A'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={user.role === 'admin' ? 'bg-red-600' : 'bg-gray-600'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-green-600 font-medium">
                        <DollarSign className="w-4 h-4" />
                        {(user.total_earnings || 0).toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-gray-600 text-sm">
                        <Calendar className="w-4 h-4" />
                        {new Date(user.created_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline"
                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() => handleImpersonate(user)}
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? "Can't impersonate yourself" : `Impersonate ${user.full_name || user.email}`}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Impersonate
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setEditingUser(user)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit User: {user.email}</DialogTitle>
                          </DialogHeader>
                          {editingUser && editingUser.id === user.id && (
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Full Name</label>
                                <Input
                                  value={editingUser.full_name || ''}
                                  onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Role</label>
                                <Select 
                                  value={editingUser.role} 
                                  onValueChange={(val) => setEditingUser({...editingUser, role: val})}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Total Earnings</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingUser.total_earnings || 0}
                                  onChange={(e) => setEditingUser({...editingUser, total_earnings: parseFloat(e.target.value)})}
                                />
                              </div>
                              <Button 
                                className="w-full bg-red-600 hover:bg-red-700"
                                onClick={() => updateUserMutation.mutate({
                                  userId: editingUser.id,
                                  updates: {
                                    full_name: editingUser.full_name,
                                    role: editingUser.role,
                                    total_earnings: editingUser.total_earnings
                                  }
                                })}
                              >
                                Save Changes
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}